import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "base",
  chainType: "op",
});

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Initializing deployer with account:", deployer.address);

  // Deployed contract addresses (from ignition deployments)
  const DEPLOYER_ADDRESS = "0x63C4e8DcB95149acdAAbDB6C4bA1391Fe90ab0b5";
  const FACTORY_ADDRESS = "0xF0F2114E9dd565362456b7450E035846EFaE18DD";

  console.log("\n📋 Initialization Parameters:");
  console.log("Deployer Address:", DEPLOYER_ADDRESS);
  console.log("Factory Address:", FACTORY_ADDRESS);

  // Connect to the Deployer contract
  const deployerContract = await ethers.getContractAt(
    "RadbotV1Deployer",
    DEPLOYER_ADDRESS
  );

  // Check if caller is the owner
  const owner = await deployerContract.owner();
  console.log("\n🔐 Ownership Check:");
  console.log("Deployer Owner:", owner);
  console.log("Caller:", deployer.address);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Error: You are not the owner of the deployer contract");
    console.log("Only the owner can initialize the deployer");
    process.exit(1);
  }
  console.log("✅ Caller is the deployer owner");

  // Check if deployer is already initialized
  console.log("\n🔍 Deployer State Check:");
  try {
    const currentFactory = await deployerContract.factory();
    console.log("Current Factory:", currentFactory);
    console.log("Target Factory:", FACTORY_ADDRESS);
    if (currentFactory !== ethers.ZeroAddress) {
      console.log("⚠️  Deployer appears to be already initialized");
      console.log("Current Factory:", currentFactory);
      console.log("Target Factory:", FACTORY_ADDRESS);

      if (currentFactory.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
        console.log(
          "✅ Deployer is already initialized with the correct factory"
        );
        console.log("No action needed");
        return;
      } else {
        console.log("❌ Deployer is initialized with a different factory");
        console.log("Cannot re-initialize deployer");
        process.exit(1);
      }
    } else {
      console.log("✅ Deployer is uninitialized, ready for initialization");
    }
  } catch (error: any) {
    if (error.message.includes("DeployerV1_NotInitialized")) {
      console.log("✅ Deployer is uninitialized (confirmed by contract)");
    } else {
      console.log("Error checking deployer state:", error.message);
    }
  }

  // Verify the factory address is valid
  console.log("\n🏭 Factory Verification:");
  try {
    const factory = await ethers.getContractAt(
      "RadbotV1Factory",
      FACTORY_ADDRESS
    );
    const factoryOwner = await factory.owner();
    console.log("Factory Owner:", factoryOwner);
    console.log("✅ Factory contract is accessible");
  } catch (error: any) {
    console.error("❌ Error accessing factory contract:", error.message);
    console.log("Please verify the factory address is correct");
    process.exit(1);
  }

  // Execute deployer initialization
  console.log("\n⏳ Initializing Deployer...");
  console.log("Setting factory:", FACTORY_ADDRESS);

  try {
    const tx = await deployerContract.initDeployer(FACTORY_ADDRESS);
    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log(
      "✅ Deployer initialization confirmed in block:",
      receipt?.blockNumber
    );
    console.log("Gas used:", receipt?.gasUsed.toString());

    // Verify initialization
    console.log("\n🔍 Verifying Initialization:");
    const initializedFactory = await deployerContract.factory();

    console.log("Factory Address:", initializedFactory);

    if (initializedFactory.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
      console.log("✅ Factory address set correctly");
    } else {
      console.log("❌ Factory address mismatch");
      console.log("Expected:", FACTORY_ADDRESS);
      console.log("Got:", initializedFactory);
    }

    // Test that deployer is now initialized by calling a function that requires initialization
    try {
      // This will only succeed if the deployer is properly initialized
      await deployerContract.getDeployInfo(ethers.ZeroAddress, 0);
      console.log("✅ Deployer is fully initialized and functional");
    } catch (error: any) {
      if (error.message.includes("DeployerV1_NotInitialized")) {
        console.log(
          "❌ Deployer initialization failed - still not initialized"
        );
      } else {
        console.log(
          "✅ Deployer is initialized (error is expected for invalid parameters)"
        );
      }
    }
  } catch (error: any) {
    console.error("❌ Deployer initialization failed:", error.message);

    // Provide helpful error messages for common issues
    if (error.message.includes("DeployerV1_AlreadyInitialized")) {
      console.log("Error: Deployer is already initialized");
    } else if (error.message.includes("DeployerV1_ZeroAddress")) {
      console.log("Error: Factory address cannot be zero address");
    } else if (error.message.includes("Ownable: caller is not the owner")) {
      console.log("Error: Only the deployer owner can initialize");
    }

    process.exit(1);
  }

  console.log("\n🎯 Deployer Initialization Summary:");
  console.log("✅ Deployer successfully initialized");
  console.log("✅ Factory address configured");
  console.log("✅ Deployer is now ready to deploy agents");

  console.log("\nNext steps:");
  console.log("1. Use the deployer to deploy individual agent contracts");
  console.log("2. Or use the factory to create agent contracts directly");
  console.log("3. Mint NFTs using the mint router");

  console.log("\nDeployer Address:", DEPLOYER_ADDRESS);
  console.log("Factory Address:", FACTORY_ADDRESS);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
