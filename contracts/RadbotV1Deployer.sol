// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IRadbotV1FactoryPayment} from "@v1-types/factory/IRadbotV1FactoryPayment.sol";
import {IRadbotV1Deployer, IRadbotV1DeployerAction, IRadbotV1DeployerOwnerAction, IRadbotV1DeployerState} from "@v1-types/IRadbotV1Deployer.sol";
import {IRadbotV1DeployerTypes} from "@v1-types/deployer/IRadbotV1DeployerTypes.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {NoDelegateCall} from "./extensions/NoDelegateCall.sol";
import {IRadbotV1DeployCallback} from "@v1-types/callback/IRadbotV1DeployCallback.sol";
import {IRadbotV1StopCallback} from "@v1-types/callback/IRadbotV1StopCallback.sol";
import {IRadbotV1FactoryState} from "@v1-types/factory/IRadbotV1FactoryState.sol";
import {TransferHelper} from "./libraries/TransferHelper.sol";
import {IRadbotV1AgentDeployerAction, IRadbotV1AgentTypes} from "@v1-types/agent/IRadbotV1AgentDeployerAction.sol";

contract RadbotV1Deployer is
    IRadbotV1Deployer,
    IERC721Receiver,
    Ownable2Step,
    ReentrancyGuard,
    NoDelegateCall,
    IRadbotV1AgentTypes
{
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    // State management
    bool private _initialized;

    address public override factory;
    uint256 public override fee;

    // nftContract => tokenId => DeployInfo
    mapping(address => mapping(uint256 => DeployInfo)) private _deploys;

    // user => nftContract => tokenIds
    mapping(address => mapping(address => EnumerableSet.UintSet))
        private _userTokens;

    modifier onlyInitialized() {
        if (!_initialized) revert DeployerV1_NotInitialized();
        _;
    }

    constructor() Ownable(msg.sender) {}

    /// @notice Required to receive NFTs
    function onERC721Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes calldata /*data*/
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /// @inheritdoc IRadbotV1DeployerAction
    function deploy(
        address from,
        address token,
        uint256 agentId,
        bytes calldata data
    ) external override onlyInitialized noDelegateCall nonReentrant {
        if (from == address(0)) revert DeployerV1_ZeroAddress();
        if (token == address(0)) revert DeployerV1_ZeroAddress();
        if (agentId == 0) revert DeployerV1_InvalidAgentId();
        if (data.length == 0) revert DeployerV1_EmptyData();
        _deploy(from, token, agentId, data);
    }

    function _deploy(
        address from,
        address token,
        uint256 agentId,
        bytes calldata data
    ) private {
        (
            IRadbotV1DeployerTypes.DeployData memory deployData,
            IRadbotV1AgentTypes.AgentTraits memory traits
        ) = abi.decode(
                data,
                (
                    IRadbotV1DeployerTypes.DeployData,
                    IRadbotV1AgentTypes.AgentTraits
                )
            );
        address agent = _getAgent(
            deployData.name,
            deployData.symbol,
            deployData.maxAgents
        );

        if (_deploys[agent][agentId].owner != address(0))
            revert DeployerV1_AlreadyDeployed();

        // Record balances before callback
        uint256 agentBalanceBefore = IERC721(agent).balanceOf(address(this));
        uint256 feeBalanceBefore = fee > 0 ? _getBalance(token) : 0;

        IRadbotV1DeployCallback(msg.sender).onAgentV1Deploy(
            deployData.payer,
            token,
            agentId,
            data
        );

        if (IERC721(agent).ownerOf(agentId) != address(this))
            revert DeployerV1_NotReceived();

        uint256 agentBalanceAfter = IERC721(agent).balanceOf(address(this));
        if (agentBalanceAfter != agentBalanceBefore + 1)
            revert DeployerV1_NotReceived();

        uint256 feePaid = 0;
        if (fee > 0) {
            uint256 feeBalanceAfter = _getBalance(token);
            feePaid = feeBalanceAfter - feeBalanceBefore;
            if (feePaid < fee) revert DeployerV1_InsufficientFee();
        }

        _deploys[agent][agentId] = DeployInfo({
            owner: from,
            nftContract: agent,
            agentId: agentId,
            timestamp: block.timestamp
        });

        _userTokens[from][agent].add(agentId);

        IRadbotV1AgentDeployerAction(agent).traitsUpdate(traits, agentId);

        emit AgentDeployed(from, agent, agentId, msg.sender, feePaid);
    }

    /// @inheritdoc IRadbotV1DeployerAction
    function stop(
        address to,
        address token,
        uint256 agentId,
        bytes calldata data
    ) external override onlyInitialized noDelegateCall nonReentrant {
        if (to == address(0)) revert DeployerV1_ZeroAddress();
        if (token == address(0)) revert DeployerV1_ZeroAddress();
        if (agentId == 0) revert DeployerV1_InvalidAgentId();
        if (data.length == 0) revert DeployerV1_EmptyData();

        _stop(to, token, agentId, data);
    }

    function _stop(
        address to,
        address token,
        uint256 agentId,
        bytes calldata data
    ) private {
        (
            IRadbotV1DeployerTypes.DeployData memory deployData,
            IRadbotV1AgentTypes.AgentTraits memory traits
        ) = abi.decode(
                data,
                (
                    IRadbotV1DeployerTypes.DeployData,
                    IRadbotV1AgentTypes.AgentTraits
                )
            );
        address agent = _getAgent(
            deployData.name,
            deployData.symbol,
            deployData.maxAgents
        );

        DeployInfo memory deployInfo = _deploys[agent][agentId];
        if (deployInfo.owner == address(0)) revert DeployerV1_NotDeployed();
        if (deployInfo.owner != to) revert DeployerV1_NotOwner();

        // Verify we still have the NFT
        if (IERC721(agent).ownerOf(agentId) != address(this))
            revert DeployerV1_NotReceived();

        // Clean up deployment info
        delete _deploys[agent][agentId];
        _userTokens[to][agent].remove(agentId);

        // Record balances before callback
        uint256 agentBalanceBefore = IERC721(agent).balanceOf(address(this));
        uint256 feeBalanceBefore = fee > 0 ? _getBalance(token) : 0;

        IRadbotV1AgentDeployerAction(agent).traitsUpdate(traits, agentId);

        IRadbotV1StopCallback(msg.sender).onAgentV1Stop(
            deployData.payer,
            token,
            agentId,
            data
        );

        // Verify fee was paid if required
        uint256 feePaid = 0;
        if (fee > 0) {
            uint256 feeBalanceAfter = _getBalance(token);
            feePaid = feeBalanceAfter - feeBalanceBefore;
            if (feePaid < fee) revert DeployerV1_InsufficientFee();
        }

        // Transfer NFT from this contract to the specified address
        IERC721(agent).safeTransferFrom(address(this), to, agentId);

        // Verify NFT was transferred out
        uint256 agentBalanceAfter = IERC721(agent).balanceOf(address(this));
        if (agentBalanceAfter != agentBalanceBefore - 1)
            revert DeployerV1_NotTransferred();

        emit AgentStopped(to, agent, agentId, msg.sender, feePaid);
    }

    /// @inheritdoc IRadbotV1DeployerOwnerAction
    function setFee(uint256 fee_) external override onlyOwner {
        uint256 oldFee = fee;
        fee = fee_;
        emit FeeUpdated(oldFee, fee_);
    }

    /// @inheritdoc IRadbotV1DeployerOwnerAction
    function withdrawFees(
        address token,
        address to,
        uint256 amount
    ) external override onlyOwner {
        if (token == address(0)) revert DeployerV1_ZeroAddress();
        if (to == address(0)) revert DeployerV1_ZeroAddress();
        if (!_canPay(token)) revert DeployerV1_NotPayable();

        TransferHelper.safeTransfer(token, to, amount);
        emit FeeWithdrawn(token, to, amount);
    }

    /// @inheritdoc IRadbotV1DeployerState
    function balance(address token) external view override returns (uint256) {
        if (token == address(0)) revert DeployerV1_ZeroAddress();
        if (!_canPay(token)) revert DeployerV1_NotPayable();
        return _getBalance(token);
    }

    /// @inheritdoc IRadbotV1DeployerState
    function agentBalance(
        address agent
    ) external view override returns (uint256) {
        return IERC721(agent).balanceOf(address(this));
    }

    /// @inheritdoc IRadbotV1DeployerAction
    function getDeployInfo(
        address agent,
        uint256 agentId
    ) external view override returns (DeployInfo memory) {
        return _deploys[agent][agentId];
    }

    /// @inheritdoc IRadbotV1DeployerAction
    function getUserAgentIds(
        address user,
        address agent
    ) external view override returns (uint256[] memory tokenIds) {
        uint256 length = _userTokens[user][agent].length();
        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            tokenIds[i] = _userTokens[user][agent].at(i);
        }
    }

    function _canPay(address token) internal view returns (bool) {
        return IRadbotV1FactoryPayment(factory).payments(token);
    }

    function _getAgent(
        bytes32 name,
        bytes16 symbol,
        uint256 maxAgents
    ) private view returns (address) {
        return IRadbotV1FactoryState(factory).getAgent(name, symbol, maxAgents);
    }

    function _getBalance(address token) private view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function initDeployer(address factory_) external override onlyOwner {
        if (_initialized) revert DeployerV1_AlreadyInitialized();
        if (factory_ == address(0)) revert DeployerV1_ZeroAddress();

        factory = factory_;
        _initialized = true;
    }
}
