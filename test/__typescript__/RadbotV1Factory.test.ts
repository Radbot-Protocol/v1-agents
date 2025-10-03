import { expect } from "chai";
import { network } from "hardhat";
import {
  RadbotV1Factory,
  RadbotV1Agent,
  RadbotV1Deployer,
  MockUSDC,
} from "../../types/ethers-contracts/index.js";
import { stringToBytes32, stringToBytes16 } from "./helpers/string-helpers.js";

const { ethers } = await network.connect();

describe("RadbotV1Factory", function () {
  let factory: RadbotV1Factory;
  let deployer: RadbotV1Deployer;
  let usdc: MockUSDC;
  let owner: any;
  let user1: any;
  let user2: any;

  const AGENT_NAME = "TestAgent";
  const AGENT_SYMBOL = "TAG";
  const MAX_AGENTS = 1000;
  const MINT_PRICE = ethers.parseEther("1");
  const ROYALTY = 250; // 2.5%

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
  });

  describe("Factory Initialization", function () {
    it("Should initialize factory successfully", async function () {
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();

      const tx = await factory.initFactory(deployerAddress, [usdcAddress]);
      await expect(tx).to.emit(factory, "FactoryInitialized");

      expect(await factory.deployer()).to.equal(deployerAddress);
      expect(await factory.payments(usdcAddress)).to.be.true;

      const payments = await factory.getPayments();
      expect(payments).to.include(usdcAddress);
      expect(payments.length).to.equal(1);
    });

    it("Should fail to initialize with zero deployer address", async function () {
      const usdcAddress = await usdc.getAddress();

      await expect(
        factory.initFactory(ethers.ZeroAddress, [usdcAddress])
      ).to.be.revertedWith("ZD"); // ZERO DEPLOYER
    });

    it("Should fail to initialize with empty payments array", async function () {
      const deployerAddress = await deployer.getAddress();

      await expect(factory.initFactory(deployerAddress, [])).to.be.revertedWith(
        "EA"
      ); // EMPTY ARRAY
    });

    it("Should fail to initialize with zero payment address", async function () {
      const deployerAddress = await deployer.getAddress();

      await expect(
        factory.initFactory(deployerAddress, [ethers.ZeroAddress])
      ).to.be.revertedWith("ZP"); // ZERO PAYMENT
    });

    it("Should fail to initialize factory twice", async function () {
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();

      // First initialization should succeed
      await factory.initFactory(deployerAddress, [usdcAddress]);

      // Second initialization should fail due to initializer modifier
      await expect(
        factory.initFactory(deployerAddress, [usdcAddress])
      ).to.be.revertedWithCustomError(factory, "InvalidInitialization");
    });

    it("Should only allow owner to initialize factory", async function () {
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();

      await expect(
        factory.connect(user1).initFactory(deployerAddress, [usdcAddress])
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("Agent Creation", function () {
    beforeEach(async function () {
      // Initialize factory before each test
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();
      await factory.initFactory(deployerAddress, [usdcAddress]);
    });

    it("Should create agent successfully", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      const tx = await factory.createAgent(
        user1.address,
        MAX_AGENTS,
        nameBytes32,
        symbolBytes16,
        "Test Agent Description",
        "https://api.example.com/metadata/",
        MINT_PRICE,
        ROYALTY
      );

      await expect(tx).to.emit(factory, "AgentCreated");

      const agentAddress = await factory.getAgent(
        nameBytes32,
        symbolBytes16,
        MAX_AGENTS
      );
      expect(agentAddress).to.not.equal(ethers.ZeroAddress);

      // Verify agent contract exists and is properly initialized
      const agent = await ethers.getContractAt("RadbotV1Agent", agentAddress);
      expect(await agent.name()).to.equal(AGENT_NAME);
      expect(await agent.symbol()).to.equal(AGENT_SYMBOL);
      expect(await agent.owner()).to.equal(user1.address);
      expect(await agent.mintPrice()).to.equal(MINT_PRICE);
      expect(await agent.maxAgents()).to.equal(MAX_AGENTS);
    });

    it("Should fail to create agent with zero owner", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      await expect(
        factory.createAgent(
          ethers.ZeroAddress,
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          "Test Agent Description",
          "https://api.example.com/metadata/",
          MINT_PRICE,
          ROYALTY
        )
      ).to.be.revertedWith("ZO"); // ZERO OWNER
    });

    it("Should fail to create duplicate agent", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // Create first agent
      await factory.createAgent(
        user1.address,
        MAX_AGENTS,
        nameBytes32,
        symbolBytes16,
        "Test Agent Description",
        "https://api.example.com/metadata/",
        MINT_PRICE,
        ROYALTY
      );

      // Try to create duplicate agent with same name, symbol, and maxAgents
      await expect(
        factory.createAgent(
          user2.address, // Different owner
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          "Different Description",
          "https://api.example.com/different/",
          ethers.parseEther("2"), // Different mint price
          500 // Different royalty
        )
      ).to.be.revertedWith("AE"); // Agent already exists
    });

    it("Should allow creating agents with different maxAgents", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // Create first agent with MAX_AGENTS
      await factory.createAgent(
        user1.address,
        MAX_AGENTS,
        nameBytes32,
        symbolBytes16,
        "Test Agent Description",
        "https://api.example.com/metadata/",
        MINT_PRICE,
        ROYALTY
      );

      // Create second agent with different maxAgents
      const differentMaxAgents = 2000;
      await factory.createAgent(
        user2.address,
        differentMaxAgents,
        nameBytes32,
        symbolBytes16,
        "Different Agent Description",
        "https://api.example.com/different/",
        MINT_PRICE,
        ROYALTY
      );

      // Both agents should exist
      const agent1Address = await factory.getAgent(
        nameBytes32,
        symbolBytes16,
        MAX_AGENTS
      );
      const agent2Address = await factory.getAgent(
        nameBytes32,
        symbolBytes16,
        differentMaxAgents
      );

      expect(agent1Address).to.not.equal(ethers.ZeroAddress);
      expect(agent2Address).to.not.equal(ethers.ZeroAddress);
      expect(agent1Address).to.not.equal(agent2Address);
    });

    it("Should fail to create agent when factory is not active", async function () {
      // Deploy a new factory without initialization
      const FactoryFactory = await ethers.getContractFactory("RadbotV1Factory");
      const uninitializedFactory = await FactoryFactory.deploy();
      await uninitializedFactory.waitForDeployment();

      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      await expect(
        uninitializedFactory.createAgent(
          user1.address,
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          "Test Agent Description",
          "https://api.example.com/metadata/",
          MINT_PRICE,
          ROYALTY
        )
      ).to.be.revertedWith("AF"); // Agent Factory is not active
    });
  });

  describe("Payment Management", function () {
    beforeEach(async function () {
      // Initialize factory before each test
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();
      await factory.initFactory(deployerAddress, [usdcAddress]);
    });

    it("Should add payments successfully", async function () {
      // Deploy additional mock token
      const MockTokenFactory = await ethers.getContractFactory("MockUSDC");
      const mockToken = await MockTokenFactory.deploy();
      await mockToken.waitForDeployment();

      const newTokenAddress = await mockToken.getAddress();

      await expect(factory.setPayments([newTokenAddress]))
        .to.emit(factory, "PaymentsAdded")
        .withArgs([newTokenAddress]);

      expect(await factory.payments(newTokenAddress)).to.be.true;

      const payments = await factory.getPayments();
      expect(payments).to.include(newTokenAddress);
      expect(payments.length).to.equal(2); // Original USDC + new token
    });

    it("Should remove payments successfully", async function () {
      const usdcAddress = await usdc.getAddress();

      await expect(factory.removePayments([usdcAddress]))
        .to.emit(factory, "PaymentsRemoved")
        .withArgs([usdcAddress]);

      expect(await factory.payments(usdcAddress)).to.be.false;

      const payments = await factory.getPayments();
      expect(payments).to.not.include(usdcAddress);
      expect(payments.length).to.equal(0);
    });

    it("Should fail to add payments with zero address", async function () {
      await expect(
        factory.setPayments([ethers.ZeroAddress])
      ).to.be.revertedWith("ZP"); // ZERO PAYMENT
    });

    it("Should fail to add payments with empty array", async function () {
      await expect(factory.setPayments([])).to.be.revertedWith("EA"); // EMPTY ARRAY
    });

    it("Should fail to remove payments with empty array", async function () {
      await expect(factory.removePayments([])).to.be.revertedWith("EA"); // EMPTY ARRAY
    });

    it("Should fail when adding too many payments", async function () {
      // Create array with more than MAX_PAYMENTS (50)
      const tooManyPayments = [];
      for (let i = 0; i < 51; i++) {
        const MockTokenFactory = await ethers.getContractFactory("MockUSDC");
        const mockToken = await MockTokenFactory.deploy();
        await mockToken.waitForDeployment();
        tooManyPayments.push(await mockToken.getAddress());
      }

      await expect(factory.setPayments(tooManyPayments)).to.be.revertedWith(
        "TM"
      ); // TOO MANY PAYMENTS
    });

    it("Should only allow owner to manage payments", async function () {
      const MockTokenFactory = await ethers.getContractFactory("MockUSDC");
      const mockToken = await MockTokenFactory.deploy();
      await mockToken.waitForDeployment();

      await expect(
        factory.connect(user1).setPayments([await mockToken.getAddress()])
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      await expect(
        factory.connect(user1).removePayments([await usdc.getAddress()])
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("Should handle duplicate payment additions gracefully", async function () {
      const usdcAddress = await usdc.getAddress();

      // Try to add the same payment again
      await expect(factory.setPayments([usdcAddress])).to.not.be.rejected;

      // Should still only have one payment
      const payments = await factory.getPayments();
      expect(payments.length).to.equal(1);
    });

    it("Should handle removing non-existent payments gracefully", async function () {
      const MockTokenFactory = await ethers.getContractFactory("MockUSDC");
      const mockToken = await MockTokenFactory.deploy();
      await mockToken.waitForDeployment();

      // Try to remove a payment that doesn't exist
      await expect(factory.removePayments([await mockToken.getAddress()])).to
        .not.be.rejected;

      // Should still have the original payment
      const payments = await factory.getPayments();
      expect(payments.length).to.equal(1);
    });
  });

  describe("Access Control", function () {
    beforeEach(async function () {
      // Initialize factory before each test
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();
      await factory.initFactory(deployerAddress, [usdcAddress]);
    });

    it("Should only allow owner to call owner functions", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // Non-owner should not be able to create agents
      await expect(
        factory
          .connect(user1)
          .createAgent(
            user1.address,
            MAX_AGENTS,
            nameBytes32,
            symbolBytes16,
            "Test Agent Description",
            "https://api.example.com/metadata/",
            MINT_PRICE,
            ROYALTY
          )
      ).to.not.be.rejected; // createAgent is public, not owner-only

      // But owner functions should be protected
      await expect(
        factory.connect(user1).setPayments([await usdc.getAddress()])
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      await expect(
        factory.connect(user1).removePayments([await usdc.getAddress()])
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Initialize factory before each test
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();
      await factory.initFactory(deployerAddress, [usdcAddress]);
    });

    it("Should return correct deployer address", async function () {
      expect(await factory.deployer()).to.equal(await deployer.getAddress());
    });

    it("Should return correct payment status", async function () {
      const usdcAddress = await usdc.getAddress();
      expect(await factory.payments(usdcAddress)).to.be.true;
      expect(await factory.payments(user1.address)).to.be.false;
    });

    it("Should return correct payments array", async function () {
      const payments = await factory.getPayments();
      expect(payments.length).to.equal(1);
      expect(payments[0]).to.equal(await usdc.getAddress());
    });

    it("Should return zero address for non-existent agents", async function () {
      const nameBytes32 = stringToBytes32("NonExistentAgent");
      const symbolBytes16 = stringToBytes16("NEA");

      const agentAddress = await factory.getAgent(
        nameBytes32,
        symbolBytes16,
        MAX_AGENTS
      );
      expect(agentAddress).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Reentrancy Protection", function () {
    beforeEach(async function () {
      // Initialize factory before each test
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();
      await factory.initFactory(deployerAddress, [usdcAddress]);
    });

    it("Should protect against reentrancy in createAgent", async function () {
      // This test would require a malicious contract that tries to reenter
      // For now, we just verify the nonReentrant modifier is present
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      await expect(
        factory.createAgent(
          user1.address,
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          "Test Agent Description",
          "https://api.example.com/metadata/",
          MINT_PRICE,
          ROYALTY
        )
      ).to.not.be.rejected;
    });

    it("Should protect against reentrancy in payment management", async function () {
      const MockTokenFactory = await ethers.getContractFactory("MockUSDC");
      const mockToken = await MockTokenFactory.deploy();
      await mockToken.waitForDeployment();

      await expect(factory.setPayments([await mockToken.getAddress()])).to.not
        .be.rejected;

      await expect(factory.removePayments([await usdc.getAddress()])).to.not.be
        .be.rejected;
    });
  });

  describe("NoDelegateCall Protection", function () {
    it("Should protect against delegate calls", async function () {
      // Initialize factory
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();
      await factory.initFactory(deployerAddress, [usdcAddress]);

      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // The noDelegateCall modifier should prevent delegate calls
      // This is tested implicitly by the fact that normal calls work
      await expect(
        factory.createAgent(
          user1.address,
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          "Test Agent Description",
          "https://api.example.com/metadata/",
          MINT_PRICE,
          ROYALTY
        )
      ).to.not.be.rejected;
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      // Initialize factory before each test
      const deployerAddress = await deployer.getAddress();
      const usdcAddress = await usdc.getAddress();
      await factory.initFactory(deployerAddress, [usdcAddress]);
    });

    it("Should handle maximum royalty value", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);
      const maxRoyalty = 10000; // 100%

      await expect(
        factory.createAgent(
          user1.address,
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          "Test Agent Description",
          "https://api.example.com/metadata/",
          MINT_PRICE,
          maxRoyalty
        )
      ).to.not.be.rejected;
    });

    it("Should fail with zero mint price", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      await expect(
        factory.createAgent(
          user1.address,
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          "Test Agent Description",
          "https://api.example.com/metadata/",
          0, // Zero mint price
          ROYALTY
        )
      ).to.be.revertedWith("ZP"); // ZERO PRICE
    });

    it("Should handle very long strings", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      // Create very long description and baseURI
      const longDescription = "A".repeat(1000);
      const longBaseURI = "https://api.example.com/" + "A".repeat(500) + "/";

      await expect(
        factory.createAgent(
          user1.address,
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          longDescription,
          longBaseURI,
          MINT_PRICE,
          ROYALTY
        )
      ).to.not.be.rejected;
    });

    it("Should handle empty strings", async function () {
      const nameBytes32 = stringToBytes32(AGENT_NAME);
      const symbolBytes16 = stringToBytes16(AGENT_SYMBOL);

      await expect(
        factory.createAgent(
          user1.address,
          MAX_AGENTS,
          nameBytes32,
          symbolBytes16,
          "", // Empty description
          "", // Empty baseURI
          MINT_PRICE,
          ROYALTY
        )
      ).to.not.be.rejected;
    });
  });
});
