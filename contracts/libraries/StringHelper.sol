// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

// Library for converting between strings and bytes32/bytes16
library StringHelper {
    // Converts a string to bytes32, left-padded with zeros
    function stringToBytes32(
        string memory source
    ) internal pure returns (bytes32 result) {
        bytes memory temp = bytes(source);
        require(temp.length <= 32, "STL");
        if (temp.length == 0) {
            return 0x0;
        }

        // Left-pad: copy string bytes to the rightmost positions
        assembly {
            // Load string data and shift it to the right position
            let data := mload(add(temp, 0x20))
            let shift := sub(32, mload(temp)) // 32 - length
            result := shr(mul(shift, 8), data) // Shift right by (shift * 8) bits
        }
    }

    // Converts a bytes32 to a string, stripping leading zeros
    function bytes32ToString(
        bytes32 source
    ) internal pure returns (string memory) {
        uint8 leadingZeros = 0;
        // Count leading zero bytes
        while (leadingZeros < 32 && source[leadingZeros] == 0) {
            leadingZeros++;
        }

        if (leadingZeros == 32) {
            return ""; // All zeros
        }

        uint8 length = 32 - leadingZeros;
        bytes memory bytesArray = new bytes(length);

        // Copy non-zero bytes starting after leading zeros
        for (uint8 i = 0; i < length; i++) {
            bytesArray[i] = source[leadingZeros + i];
        }

        return string(bytesArray);
    }

    // Converts a string to bytes16, left-padded with zeros
    function stringToBytes16(
        string memory source
    ) internal pure returns (bytes16 result) {
        bytes memory temp = bytes(source);
        require(temp.length <= 16, "STL");
        if (temp.length == 0) {
            return 0x0;
        }

        // Left-pad: copy string bytes to the rightmost positions
        assembly {
            // Load string data and shift it to the right position
            let data := mload(add(temp, 0x20))
            let shift := sub(16, mload(temp)) // 16 - length
            result := shr(mul(shift, 8), data) // Shift right by (shift * 8) bits
        }
    }

    // Converts a bytes16 to a string, stripping leading zeros
    function bytes16ToString(
        bytes16 source
    ) internal pure returns (string memory) {
        uint8 leadingZeros = 0;
        // Count leading zero bytes
        while (leadingZeros < 16 && source[leadingZeros] == 0) {
            leadingZeros++;
        }

        if (leadingZeros == 16) {
            return ""; // All zeros
        }

        uint8 length = 16 - leadingZeros;
        bytes memory bytesArray = new bytes(length);

        // Copy non-zero bytes starting after leading zeros
        for (uint8 i = 0; i < length; i++) {
            bytesArray[i] = source[leadingZeros + i];
        }

        return string(bytesArray);
    }
}
