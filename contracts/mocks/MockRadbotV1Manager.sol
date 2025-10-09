// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRadbotV1DeployCallback} from "@v1-types/callback/IRadbotV1DeployCallback.sol";
import {IRadbotV1StopCallback} from "@v1-types/callback/IRadbotV1StopCallback.sol";
import {IRadbotV1Deployer} from "@v1-types/IRadbotV1Deployer.sol";
import {IRadbotV1FactoryState} from "@v1-types/factory/IRadbotV1FactoryState.sol";
import {IRadbotV1DeployerTypes} from "@v1-types/deployer/IRadbotV1DeployerTypes.sol";
import {IRadbotV1AgentTypes} from "@v1-types/agent/IRadbotV1AgentTypes.sol";

/// @title Example implementation of RadbotV1 callbacks
/// @notice This contract shows how to properly implement the callback interface
/// @dev The callback implementer is responsible for transferring both NFTs and fees
contract MockRadbotV1Manager is IRadbotV1DeployCallback, IRadbotV1StopCallback {
    using SafeERC20 for IERC20;

    IRadbotV1Deployer public immutable deployer;

    error UnauthorizedCallback();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(address deployer_) {
        deployer = IRadbotV1Deployer(deployer_);
    }

    /// @notice Deploy an agent
    /// @param user The user who owns the agent
    /// @param token The payment token
    /// @param agentId The agent ID
    /// @param data Encoded deployment data containing agent info
    function deployAgent(
        address user,
        address token,
        uint256 agentId,
        bytes calldata data
    ) external {
        // This triggers the callback below
        deployer.deploy(user, token, agentId, data);
    }

    /// @notice Callback for agent deployment
    /// @dev This is called by the deployer during deploy()
    /// @param from The address that owns the agent
    /// @param token The payment token
    /// @param agentId The agent ID
    /// @param data Encoded deployment data
    function onAgentV1Deploy(
        address from,
        address token,
        uint256 agentId,
        bytes calldata data
    ) external override {
        // Verify caller is the deployer
        if (msg.sender != address(deployer)) revert UnauthorizedCallback();

        // Decode the deployment data
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

        // Get the agent contract address from factory
        address agent = IRadbotV1FactoryState(deployer.factory()).getAgent(
            deployData.name,
            deployData.symbol,
            deployData.maxAgents
        );

        // 1. Transfer the NFT from from to deployer
        // The from must have approved this contract to transfer their NFT
        IERC721(agent).safeTransferFrom(from, address(deployer), agentId);

        // 2. Transfer the fee from from to deployer (if fee > 0)
        uint256 fee = deployer.fee();
        if (fee > 0) {
            // The from must have approved this contract to spend their tokens
            IERC20(token).safeTransferFrom(from, address(deployer), fee);
        }
    }

    /// @notice Stop an agent deployment
    /// @param user The user who will receive the NFT back
    /// @param token The payment token
    /// @param agentId The agent ID
    /// @param data Encoded deployment data
    function stopAgent(
        address user,
        address token,
        uint256 agentId,
        bytes calldata data
    ) external {
        // This triggers the callback below
        deployer.stop(user, token, agentId, data);
    }

    /// @notice Callback for agent stopping
    /// @dev This is called by the deployer during stop()
    /// @param to The address that will receive the NFT back
    /// @param token The payment token
    /// @param agentId The agent ID
    /// @param data Encoded deployment data
    function onAgentV1Stop(
        address to,
        address token,
        uint256 agentId,
        bytes calldata data
    ) external override {
        // Verify caller is the deployer
        if (msg.sender != address(deployer)) revert UnauthorizedCallback();

        // Decode the deployment data
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

        // Transfer the fee from to to deployer (if fee > 0)
        uint256 fee = deployer.fee();
        if (fee > 0) {
            // The to must have approved this contract to spend their tokens
            IERC20(token).safeTransferFrom(to, address(deployer), fee);
        }
    }

    /// @notice Required to receive NFTs
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
