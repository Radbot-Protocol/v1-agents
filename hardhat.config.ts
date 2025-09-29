import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatContractSizer from "@solidstate/hardhat-contract-sizer";
import { configVariable } from "hardhat/config";

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin, hardhatContractSizer],
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    strict: true,
  },

  paths: {
    sources: ["./contracts"],
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 100,
          },
          evmVersion: "istanbul",
          metadata: {
            bytecodeHash: "none",
          },
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 100,
          },
          evmVersion: "istanbul",
          metadata: {
            bytecodeHash: "none",
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    base: {
      type: "http",
      chainType: "op",
      url: process.env.BASE_RPC_URL as string,
      accounts: process.env.BASE_PRIVATE_KEY
        ? [process.env.BASE_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
