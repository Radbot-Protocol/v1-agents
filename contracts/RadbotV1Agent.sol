// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRadbotV1Agent, IRadbotV1AgentImmutables, IRadbotV1AgentState, IRadbotV1AgentDeployerAction, IRadbotV1AgentOwnerAction, IRadbotV1AgentAction} from "@v1-types/IRadbotV1Agent.sol";
import {IERC4906Minimal} from "@v1-types/IERC4906Minimal.sol";
import {IRadbotV1MintCallback} from "@v1-types/callback/IRadbotV1MintCallback.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IRadbotV1FactoryImmutable} from "@v1-types/factory/IRadbotV1FactoryImmutable.sol";
import {IRadbotV1FactoryPayment} from "@v1-types/factory/IRadbotV1FactoryPayment.sol";
import {IRadbotV1AgentLauncher} from "@v1-types/factory/IRadbotV1AgentLauncher.sol";

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

import {NoDelegateCall} from "./extensions/NoDelegateCall.sol";

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "./libraries/base64.sol";

import {TransferHelper} from "./libraries/TransferHelper.sol";
import {StringHelper} from "./libraries/StringHelper.sol";

contract RadbotV1Agent is
    IRadbotV1Agent,
    IERC4906Minimal,
    ERC721,
    ERC2981,
    NoDelegateCall,
    Ownable2Step,
    ReentrancyGuard
{
    using Strings for uint256;

    string private _name;
    string private _symbol;
    string private _baseURIString;
    string private _description;
    uint256 private _nextTokenId;

    mapping(uint256 => AgentTraits) private _traits;

    /// @inheritdoc IRadbotV1AgentImmutables
    uint256 public immutable override maxAgents;

    /// @inheritdoc IRadbotV1AgentImmutables
    uint256 public immutable override mintPrice;

    /// @inheritdoc IRadbotV1AgentImmutables
    address public immutable override factory;

    modifier onlyDeployer() {
        require(
            msg.sender == IRadbotV1FactoryImmutable(factory).deployer(),
            "ND" // NOT DEPLOYER
        );
        _;
    }

    constructor() ERC721("", "") Ownable(msg.sender) {
        (
            address owner_,
            uint256 mintPrice_,
            uint256 maxAgents_,
            bytes32 name_,
            bytes16 symbol_,
            string memory description_,
            string memory baseURI_,
            uint16 royalty_,
            address factory_
        ) = IRadbotV1AgentLauncher(msg.sender).parameters();

        require(royalty_ <= _feeDenominator(), "RO"); // Royalty Overflow
        require(maxAgents_ > 0 && maxAgents_ <= type(uint128).max, "IA"); // INVALID AMOUNT
        require(mintPrice_ > 0, "ZP"); // ZERO PRICE

        string memory nameStr = StringHelper.bytes32ToString(name_);
        string memory symbolStr = StringHelper.bytes16ToString(symbol_);

        require(bytes(nameStr).length > 3, "TS"); // TOO SHORT NAME
        require(bytes(symbolStr).length >= 1, "TS"); // TOO SHORT SYMBOL

        _name = nameStr;
        _symbol = symbolStr;
        _baseURIString = baseURI_;
        _description = description_;
        maxAgents = maxAgents_;
        factory = factory_;
        mintPrice = mintPrice_;
        _nextTokenId = 1; // Skips to 1

        _setDefaultRoyalty(owner_, royalty_);
        _transferOwnership(owner_);
    }

    /// @inheritdoc ERC721
    function name() public view override returns (string memory) {
        return _name;
    }

    /// @inheritdoc ERC721
    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /// @inheritdoc IRadbotV1AgentAction
    function mint(
        address to,
        address token,
        bytes calldata data
    ) external override noDelegateCall nonReentrant returns (uint256 tokenId) {
        return _mint(to, token, data);
    }

    function _mint(
        address to,
        address token,
        bytes calldata data
    ) private returns (uint256 tokenId) {
        require(to != address(0), "ZA");
        require(_nextTokenId <= maxAgents, "MA");

        // ASSIGN TOKEN ID FIRST
        tokenId = _nextTokenId;
        _nextTokenId++; // UPDATE STATE BEFORE EXTERNAL CALLS

        uint256 balanceStart = balance(token);

        // CALLBACK
        IRadbotV1MintCallback(msg.sender).onAgentV1Mint(token, data);

        uint256 balanceEnd = balance(token);
        require(balanceEnd >= balanceStart + mintPrice, "MP");

        // MINT LAST
        _safeMint(to, tokenId);
    }

    /// @inheritdoc IRadbotV1AgentDeployerAction
    function traitsUpdate(
        AgentTraits calldata traits,
        uint256 tokenId
    ) external override onlyDeployer nonReentrant {
        _updateMetadata(tokenId, traits);
    }

    function _updateMetadata(
        uint256 tokenId,
        AgentTraits calldata traits
    ) private {
        require(_exists(tokenId), "NT"); // NOT EXISTING TOKEN ID
        _traits[tokenId] = traits;
        emit MetadataUpdate(tokenId);
    }

    function updateBaseURI(
        string calldata baseURI
    ) external override onlyOwner nonReentrant {
        _updateBaseURI(baseURI);
    }

    function _updateBaseURI(string calldata baseURI) private {
        _baseURIString = baseURI;
        if (_nextTokenId > 1) {
            emit BatchMetadataUpdate(1, _nextTokenId - 1);
        }
    }

    /// @inheritdoc IRadbotV1AgentOwnerAction
    function withdraw(
        address token,
        address to,
        uint256 amount
    ) external override onlyOwner nonReentrant {
        require(to != address(0), "ZA"); // ZERO ADDRESS
        require((balance(token) >= amount), "BA"); // BALANCE NOT ENOUGH
        TransferHelper.safeTransfer(token, to, amount);
    }

    /// @inheritdoc IRadbotV1AgentState
    function balance(address token) public view override returns (uint256) {
        require(token != address(0), "ZA"); // ZERO ADDRESS
        require(_canPay(token), "NP"); // NOT PAYABLE
        return IERC20(token).balanceOf(address(this));
    }

    /// @inheritdoc ERC721
    function _baseURI() internal view override returns (string memory) {
        return _baseURIString;
    }

    /// @inheritdoc ERC721
    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(_exists(tokenId), "NT"); // Non-existent token

        string memory image = string(
            abi.encodePacked(_baseURI(), tokenId.toString(), ".png")
        );

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{ "name": "',
                        _name,
                        " #",
                        tokenId.toString(),
                        '", "description": "',
                        _description,
                        '", "image": "',
                        image,
                        '", "attributes": [',
                        '{"trait_type": "Status", "value": "',
                        _traits[tokenId].status == 1 ? "DEPLOYED" : "INACTIVE",
                        '"},',
                        '{"trait_type": "Deployments", "value": "',
                        uint256(_traits[tokenId].deployments).toString(),
                        '"},',
                        '{"trait_type": "Yield", "value": "',
                        uint256(_traits[tokenId].yield).toString(),
                        '"}',
                        "]",
                        "}"
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /// @inheritdoc ERC2981
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _exists(uint256 tokenId) private view returns (bool) {
        return tokenId > 0 && tokenId < _nextTokenId;
    }

    function _canPay(address token) internal view returns (bool) {
        return IRadbotV1FactoryPayment(factory).payments(token);
    }
}
