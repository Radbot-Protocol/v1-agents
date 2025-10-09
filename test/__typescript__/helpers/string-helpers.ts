import { network } from "hardhat";

const { ethers } = await network.connect();

const { toUtf8Bytes, toUtf8String, getBytes, hexlify, concat } = ethers;

// Converts a string to bytes32, supporting up to 32 bytes (left-padded with zeros)
export function stringToBytes32(str: string): string {
  const bytes = toUtf8Bytes(str); // Throws if string is invalid UTF-8
  if (bytes.length > 32) {
    throw new Error("String too long for bytes32");
  }

  // Left-pad with zeros: zeros first, then the string bytes
  const padding = new Uint8Array(32 - bytes.length);
  const paddedBytes = concat([padding, bytes]);
  return hexlify(paddedBytes);
}

// Converts a bytes32 to a string, stripping leading zeros
export function bytes32ToString(b32: string): string {
  const bytes = getBytes(b32);
  let start = 0;
  // Skip leading zeros
  while (start < bytes.length && bytes[start] === 0) {
    start++;
  }
  if (start === bytes.length) {
    return ""; // All zeros
  }
  return toUtf8String(bytes.slice(start)); // Throws if bytes are invalid UTF-8
}

// Converts a string to bytes16, supporting up to 16 bytes (left-padded with zeros)
export function stringToBytes16(str: string): string {
  const bytes = toUtf8Bytes(str); // Throws if string is invalid UTF-8
  if (bytes.length > 16) {
    throw new Error("String too long for bytes16");
  }

  // Left-pad with zeros: zeros first, then the string bytes
  const padding = new Uint8Array(16 - bytes.length);
  const paddedBytes = concat([padding, bytes]);
  return hexlify(paddedBytes);
}

// Converts a bytes16 to a string, stripping leading zeros
export function bytes16ToString(b16: string): string {
  const bytes = getBytes(b16);
  let start = 0;
  // Skip leading zeros
  while (start < bytes.length && bytes[start] === 0) {
    start++;
  }
  if (start === bytes.length) {
    return ""; // All zeros
  }
  return toUtf8String(bytes.slice(start)); // Throws if bytes are invalid UTF-8
}
