// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRadbotV1Factory, IRadbotV1FactoryImmutable, IRadbotV1FactoryAction, IRadbotV1FactoryOwnerAction, IRadbotV1AgentLauncher, IRadbotV1FactoryPayment} from "@v1-types/IRadbotV1Factory.sol";
import {RadbotV1Agent} from "./RadbotV1Agent.sol";

import {NoDelegateCall} from "./extensions/NoDelegateCall.sol";

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract RadbotV1Factory is
    IRadbotV1Factory,
    Ownable2Step,
    NoDelegateCall,
    ReentrancyGuard,
    Initializable
{
    using EnumerableSet for EnumerableSet.AddressSet;
    // State constants
    uint8 private constant STATE_UNINITIALIZED = 1;
    uint8 private constant STATE_ACTIVE = 2;

    // Maximum number of payment addresses to prevent array DoS
    uint256 private constant MAX_PAYMENTS = 50;

    uint8 private _state = STATE_UNINITIALIZED;

    /// @inheritdoc IRadbotV1AgentLauncher
    AgentParams public override parameters;

    /// @inheritdoc IRadbotV1FactoryPayment
    mapping(address => bool) public override payments;

    EnumerableSet.AddressSet private _paymentAddresses;

    /// @inheritdoc IRadbotV1FactoryImmutable
    address public override deployer;

    mapping(bytes32 => mapping(bytes16 => mapping(uint256 => address)))
        public
        override getAgent;

    struct AgentParams {
        address owner;
        uint256 mintPrice;
        uint256 maxAgents;
        bytes32 name;
        bytes16 symbol;
        string description;
        string baseURI;
        uint16 royalty;
        address factory;
    }

    modifier onlyActive() {
        require(_state == STATE_ACTIVE, "AF"); // Agent Factory is not active
        _;
    }

    constructor() Ownable(msg.sender) {}

    /// @inheritdoc IRadbotV1FactoryAction
    function createAgent(
        address owner,
        uint256 maxAgents,
        bytes32 name,
        bytes16 symbol,
        string memory description,
        string memory baseURI,
        uint256 mintPrice,
        uint16 royalty
    )
        external
        override
        noDelegateCall
        onlyActive
        nonReentrant
        returns (address)
    {
        return
            _create(
                owner,
                maxAgents,
                name,
                symbol,
                description,
                baseURI,
                mintPrice,
                royalty
            );
    }

    function _create(
        address owner,
        uint256 maxAgents,
        bytes32 name,
        bytes16 symbol,
        string memory description,
        string memory baseURI,
        uint256 mintPrice,
        uint16 royalty
    ) private returns (address agent) {
        require(owner != address(0), "ZO"); // ZERO OWNER
        require(getAgent[name][symbol][maxAgents] == address(0), "AE"); // Agent already exists

        parameters = AgentParams({
            name: name,
            symbol: symbol,
            description: description,
            owner: owner,
            baseURI: baseURI,
            royalty: royalty,
            maxAgents: maxAgents,
            mintPrice: mintPrice,
            factory: address(this)
        });

        agent = address(
            new RadbotV1Agent{
                salt: keccak256(abi.encode(name, symbol, maxAgents))
            }()
        );

        getAgent[name][symbol][maxAgents] = agent;

        emit AgentCreated(agent, owner, name, symbol, maxAgents, mintPrice);

        delete parameters;
    }

    /// @inheritdoc IRadbotV1FactoryOwnerAction
    function initFactory(
        address deployer_,
        address[] calldata payments_
    ) external override onlyOwner initializer nonReentrant {
        _initFactory(deployer_, payments_);
    }

    function _initFactory(
        address deployer_,
        address[] calldata payments_
    ) private {
        require(deployer_ != address(0), "ZD"); // ZERO DEPLOYER
        require(payments_.length > 0, "EA"); // EMPTY ARRAY

        deployer = deployer_;
        _setPayments(payments_);
        _state = STATE_ACTIVE;

        emit FactoryInitialized(deployer_, payments_);
    }

    /// @inheritdoc IRadbotV1FactoryOwnerAction
    function setPayments(
        address[] calldata payments_
    ) external override onlyOwner nonReentrant {
        _setPayments(payments_);
    }

    /// @inheritdoc IRadbotV1FactoryOwnerAction
    function removePayments(
        address[] calldata payments_
    ) external override onlyOwner nonReentrant {
        _removePayments(payments_);
    }

    function getPayments() external view override returns (address[] memory) {
        return _paymentAddresses.values();
    }

    function _setPayments(address[] calldata payments_) private {
        require(payments_.length > 0, "EA"); // EMPTY ARRAY
        require(
            _paymentAddresses.length() + payments_.length <= MAX_PAYMENTS,
            "TM" // TOO MANY PAYMENTS
        );

        for (uint256 i = 0; i < payments_.length; i++) {
            require(payments_[i] != address(0), "ZP"); // ZERO PAYMENT
            if (_paymentAddresses.add(payments_[i])) {
                payments[payments_[i]] = true;
            }
        }

        emit PaymentsAdded(payments_);
    }

    function _removePayments(address[] calldata payments_) private {
        require(payments_.length > 0, "EA"); // EMPTY ARRAY

        for (uint256 i = 0; i < payments_.length; i++) {
            if (_paymentAddresses.remove(payments_[i])) {
                payments[payments_[i]] = false;
            }
        }

        emit PaymentsRemoved(payments_);
    }
}
