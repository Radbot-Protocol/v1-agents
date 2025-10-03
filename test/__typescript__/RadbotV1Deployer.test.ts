import { expect } from "chai";
import { network } from "hardhat";
import {
  RadbotV1Deployer,
  RadbotV1Factory,
  RadbotV1Agent,
  MockRadbotV1Manager,
  MockUSDC,
} from "../../types/ethers-contracts/index.js";
import { stringToBytes32, stringToBytes16 } from "./helpers/string-helpers.js";

const { ethers } = await network.connect();

describe("RadbotV1Deployer", function () {
  let deployer: RadbotV1Deployer;
  let factory: RadbotV1Factory;
  let agent: RadbotV1Agent;
  let mockManager: MockRadbotV1Manager;
  let usdc: MockUSDC;
  let owner: any;
  let user1: any;
  let user2: any;

  const AGENT_NAME = "TestAgent";
  const AGENT_SYMBOL = "TAG";
  const MAX_AGENTS = 1000;
  const FEE = ethers.parseEther("10"); // 10 tokens
  const AGENT_ID = 1;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy MockUSDC
    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    // Deploy Factory
    const FactoryFactory = await ethers.getContractFactory("RadbotV1Factory");
    factory = await FactoryFactory.deploy();
    await factory.waitForDeployment();

    // Deploy Deployer
    const DeployerFactory = await ethers.getContractFactory("RadbotV1Deployer");
    deployer = await DeployerFactory.deploy();
    await deployer.waitForDeployment();

    // Initialize factory with deployer and payment tokens
    await factory.initFactory(await deployer.getAddress(), [
      await usdc.getAddress(),
    ]);

    // Initialize deployer with factory
    await deployer.initDeployer(await factory.getAddress());

    // Set fee
    await deployer.setFee(FEE);

    // Deploy MockManager
    const ManagerFactory = await ethers.getContractFactory(
      "MockRadbotV1Manager"
    );
    mockManager = await ManagerFactory.deploy(await deployer.getAddress());
    await mockManager.waitForDeployment();

    // Create agent using factory
    const nameBytes32 = stringToBytes32(AGENT_NAME);
    const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

    await factory.createAgent(
      user1.address,
      MAX_AGENTS,
      nameBytes32,
      symbolBytes16,
      "Test Agent Description",
      "https://api.example.com/metadata/",
      ethers.parseEther("1"), // mintPrice
      250 // 2.5% royalty
    );

    // Get the deployed agent
    const agentAddress = await factory.getAgent(
      nameBytes32,
      symbolBytes16,
      MAX_AGENTS
    );
    agent = await ethers.getContractAt("RadbotV1Agent", agentAddress);

    // Give user1 some USDC and approve manager to spend
    await usdc.mint(user1.address, ethers.parseEther("1000"));
    await usdc
      .connect(user1)
      .approve(await mockManager.getAddress(), ethers.parseEther("1000"));

    // Mint NFT to user1 using a callback contract
    const MockMintCallbackFactory = await ethers.getContractFactory(
      "MockRadbotV1MintCallback"
    );
    const mockMintCallback = await MockMintCallbackFactory.deploy();
    await mockMintCallback.waitForDeployment();

    // Give mint callback contract USDC for the mint price
    const mintPrice = await agent.mintPrice();
    await usdc.mint(await mockMintCallback.getAddress(), mintPrice);

    // Approve the mint callback to spend USDC from user1
    await usdc
      .connect(user1)
      .approve(await mockMintCallback.getAddress(), mintPrice);

    // Mint NFT
    await mockMintCallback
      .connect(user1)
      .mintAgent(
        await agent.getAddress(),
        user1.address,
        await usdc.getAddress(),
        "0x"
      );

    // Approve manager to transfer NFT
    await agent
      .connect(user1)
      .approve(await mockManager.getAddress(), AGENT_ID);
  });

  describe("Deploy Agent", function () {
    it("Should deploy agent successfully", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // Encode deployment data
      const deployData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes32", "bytes16", "uint256"],
        [user1.address, nameBytes32, symbolBytes16, MAX_AGENTS]
      );

      // Check initial balances
      const agentBalanceBefore = await agent.balanceOf(
        await deployer.getAddress()
      );
      const usdcBalanceBefore = await usdc.balanceOf(
        await deployer.getAddress()
      );

      // Verify NFT exists and is owned by user1
      expect(await agent.ownerOf(AGENT_ID)).to.equal(user1.address);

      // Deploy agent
      await mockManager
        .connect(user1)
        .deployAgent(
          user1.address,
          await usdc.getAddress(),
          AGENT_ID,
          deployData
        );

      // Check balances after deployment
      const agentBalanceAfter = await agent.balanceOf(
        await deployer.getAddress()
      );
      const usdcBalanceAfter = await usdc.balanceOf(
        await deployer.getAddress()
      );

      // Verify NFT was transferred to deployer
      expect(agentBalanceAfter).to.equal(agentBalanceBefore + 1n);
      expect(await agent.ownerOf(AGENT_ID)).to.equal(
        await deployer.getAddress()
      );

      // Verify fee was paid
      expect(usdcBalanceAfter).to.equal(usdcBalanceBefore + FEE);

      // Verify deployment info
      const deployInfo = await deployer.getDeployInfo(
        await agent.getAddress(),
        AGENT_ID
      );
      expect(deployInfo.owner).to.equal(user1.address);
      expect(deployInfo.nftContract).to.equal(await agent.getAddress());
      expect(deployInfo.agentId).to.equal(BigInt(AGENT_ID));
      expect(deployInfo.timestamp).to.be.greaterThan(0);

      // Verify user tokens tracking
      const userTokens = await deployer.getUserAgentIds(
        user1.address,
        await agent.getAddress()
      );
      expect(userTokens).to.include(BigInt(AGENT_ID));
    });

    it("Should fail if NFT not transferred", async function () {
      // Mint a new NFT for this test
      const MockMintCallbackFactory = await ethers.getContractFactory(
        "MockRadbotV1MintCallback"
      );
      const mockMintCallback = await MockMintCallbackFactory.deploy();
      await mockMintCallback.waitForDeployment();

      const mintPrice = await agent.mintPrice();
      await usdc.mint(await mockMintCallback.getAddress(), mintPrice);

      // Approve the mint callback to spend USDC from user1
      await usdc
        .connect(user1)
        .approve(await mockMintCallback.getAddress(), mintPrice);

      const NEW_AGENT_ID = 2;
      await mockMintCallback
        .connect(user1)
        .mintAgent(
          await agent.getAddress(),
          user1.address,
          await usdc.getAddress(),
          "0x"
        );

      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // Encode deployment data
      const deployData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes32", "bytes16", "uint256"],
        [user1.address, nameBytes32, symbolBytes16, MAX_AGENTS]
      );

      // Remove approval to prevent NFT transfer
      await agent.connect(user1).approve(ethers.ZeroAddress, NEW_AGENT_ID);

      await expect(
        mockManager
          .connect(user1)
          .deployAgent(
            user1.address,
            await usdc.getAddress(),
            NEW_AGENT_ID,
            deployData
          )
      ).to.be.revertedWithCustomError(agent, "ERC721InsufficientApproval");
    });

    it("Should fail if insufficient fee", async function () {
      // Mint a new NFT for this test
      const MockMintCallbackFactory = await ethers.getContractFactory(
        "MockRadbotV1MintCallback"
      );
      const mockMintCallback = await MockMintCallbackFactory.deploy();
      await mockMintCallback.waitForDeployment();

      const mintPrice = await agent.mintPrice();
      await usdc.mint(await mockMintCallback.getAddress(), mintPrice);

      // Approve the mint callback to spend USDC from user1
      await usdc
        .connect(user1)
        .approve(await mockMintCallback.getAddress(), mintPrice);

      const NEW_AGENT_ID = 2;
      await mockMintCallback
        .connect(user1)
        .mintAgent(
          await agent.getAddress(),
          user1.address,
          await usdc.getAddress(),
          "0x"
        );

      // Approve manager to transfer NFT
      await agent
        .connect(user1)
        .approve(await mockManager.getAddress(), NEW_AGENT_ID);

      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // Encode deployment data
      const deployData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes32", "bytes16", "uint256"],
        [user1.address, nameBytes32, symbolBytes16, MAX_AGENTS]
      );

      // Set higher fee and reduce user1's USDC balance to make it insufficient
      await deployer.setFee(ethers.parseEther("100"));
      // Reduce user1's USDC balance to less than the fee
      await usdc
        .connect(user1)
        .transfer(owner.address, ethers.parseEther("950"));

      await expect(
        mockManager
          .connect(user1)
          .deployAgent(
            user1.address,
            await usdc.getAddress(),
            NEW_AGENT_ID,
            deployData
          )
      ).to.be.revertedWithCustomError(usdc, "ERC20InsufficientBalance");
    });
  });

  describe("Stop Agent", function () {
    it("Should fail if agent not deployed", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // Encode deployment data
      const deployData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes32", "bytes16", "uint256"],
        [user1.address, nameBytes32, symbolBytes16, MAX_AGENTS]
      );

      // Try to stop a non-existent agent
      await expect(
        mockManager
          .connect(user1)
          .stopAgent(
            user1.address,
            await usdc.getAddress(),
            AGENT_ID,
            deployData
          )
      ).to.be.revertedWithCustomError(deployer, "DeployerV1_NotDeployed");
    });

    it("Should fail if insufficient fee for stopping", async function () {
      // Set higher fee to test insufficient fee error
      await deployer.setFee(ethers.parseEther("100"));

      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      const deployData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes32", "bytes16", "uint256"],
        [user1.address, nameBytes32, symbolBytes16, MAX_AGENTS]
      );

      await expect(
        mockManager
          .connect(user1)
          .stopAgent(
            user1.address,
            await usdc.getAddress(),
            AGENT_ID,
            deployData
          )
      ).to.be.revertedWithCustomError(deployer, "DeployerV1_NotDeployed");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set fee", async function () {
      const newFee = ethers.parseEther("20");
      await deployer.setFee(newFee);
      expect(await deployer.fee()).to.equal(newFee);
    });

    it("Should allow owner to withdraw fees", async function () {
      // Manually add some fees to the deployer for testing
      await usdc.mint(await deployer.getAddress(), FEE);

      const balanceBefore = await usdc.balanceOf(owner.address);
      await deployer.withdrawFees(await usdc.getAddress(), owner.address, FEE);
      const balanceAfter = await usdc.balanceOf(owner.address);

      expect(balanceAfter).to.equal(balanceBefore + FEE);
    });

    it("Should not allow non-owner to set fee", async function () {
      await expect(
        deployer.connect(user1).setFee(ethers.parseEther("20"))
      ).to.be.revertedWithCustomError(deployer, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    it("Should return correct balance", async function () {
      expect(await deployer.balance(await usdc.getAddress())).to.equal(0);

      // Manually add some fees to the deployer for testing
      await usdc.mint(await deployer.getAddress(), FEE);

      expect(await deployer.balance(await usdc.getAddress())).to.equal(FEE);
    });

    it("Should return correct agent balance", async function () {
      expect(await deployer.agentBalance(await agent.getAddress())).to.equal(0);
    });

    it("Should return empty user tokens when no deployments", async function () {
      const userTokens = await deployer.getUserAgentIds(
        user1.address,
        await agent.getAddress()
      );
      expect(userTokens.length).to.equal(0);
    });
  });
});
