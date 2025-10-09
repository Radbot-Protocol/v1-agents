// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRadbotV1MintCallback} from "@v1-types/callback/IRadbotV1MintCallback.sol";
import {IRadbotV1Agent} from "@v1-types/IRadbotV1Agent.sol";

/// @title Mock implementation of RadbotV1 mint callback
/// @notice This contract shows how to properly implement the mint callback interface
contract MockRadbotV1MintCallback is IRadbotV1MintCallback {
    using SafeERC20 for IERC20;

    error UnauthorizedCallback();
    error InsufficientPayment();

    /// @notice Callback for agent minting
    /// @dev This is called by the agent during mint()
    /// @param token The payment token
    function onAgentV1Mint(
        address token,
        bytes calldata /* data */
    ) external override {
        // Get mint price from agent
        uint256 mintPrice = IRadbotV1Agent(msg.sender).mintPrice();

        // Transfer payment token from this contract to the agent
        if (mintPrice > 0) {
            IERC20(token).safeTransfer(msg.sender, mintPrice);
        }
    }

    /// @notice Mint an agent NFT through this callback contract
    /// @param agent The agent contract address
    /// @param to The recipient address
    /// @param token The payment token address
    /// @param data Encoded mint data
    function mintAgent(
        address agent,
        address to,
        address token,
        bytes calldata data
    ) external returns (uint256) {
        // Get mint price from agent
        uint256 mintPrice = IRadbotV1Agent(agent).mintPrice();

        // Transfer payment token from caller to this contract
        if (mintPrice > 0) {
            IERC20(token).safeTransferFrom(
                msg.sender,
                address(this),
                mintPrice
            );
        }

        // Call agent mint function
        return IRadbotV1Agent(agent).mint(to, token, data);
    }

    /// @notice Required to receive ERC20 tokens
    function onERC20Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC20Received.selector;
    }
}
