// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title Prevents delegatecall to a contract
/// @notice Base contract that provides a modifier for preventing delegatecall to methods in a child contract
/// @dev Forked from Uniswap V3's NoDelegateCall contract
/// @author Uniswap Labs (original implementation)
/// @author RadBot (modifications and adaptations)
abstract contract NoDelegateCall {
    /// @dev The original address of this contract
    address private immutable original;

    /// @notice Constructor that sets the original address to prevent delegatecall attacks
    /// @dev Forked from Uniswap V3's NoDelegateCall constructor
    constructor() {
        // Immutables are computed in the init code of the contract, and then inlined into the deployed bytecode.
        // In other words, this variable won't change when it's checked at runtime.
        original = address(this);
    }

    /// @dev Private method is used instead of inlining into modifier because modifiers are copied into each method,
    ///     and the use of immutable means the address bytes are copied in every place the modifier is used.
    /// @dev Forked from Uniswap V3's checkNotDelegateCall function
    function checkNotDelegateCall() private view {
        require(address(this) == original, "DC");
    }

    /// @notice Prevents delegatecall into the modified method
    /// @dev Forked from Uniswap V3's noDelegateCall modifier
    modifier noDelegateCall() {
        checkNotDelegateCall();
        _;
    }
}
