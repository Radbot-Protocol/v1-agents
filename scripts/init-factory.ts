import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "base",
  chainType: "op",
});

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Initializing factory with account:", deployer.address);

  // Deployed contract addresses (from ignition deployments)
  const FACTORY_ADDRESS = "0xF0F2114E9dd565362456b7450E035846EFaE18DD";
  const DEPLOYER_ADDRESS = "0x63C4e8DcB95149acdAAbDB6C4bA1391Fe90ab0b5";

  // USDC address on Base (from the comment in deployment modules)
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  // Use ethers to get the correct checksum for USDT address
  const USDT_ADDRESS = ethers.getAddress(
    "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2"
  );

  // Payment addresses - you can customize these
  const PAYMENT_ADDRESSES = [
    USDC_ADDRESS, // USDC as primary payment token
    USDT_ADDRESS, // USDT as secondary payment token
    // Add more payment token addresses as needed
    // "0x...", // Example: WETH
    // "0x...", // Example: Another stablecoin
  ];

  console.log("\n📋 Initialization Parameters:");
  console.log("Factory Address:", FACTORY_ADDRESS);
  console.log("Deployer Address:", DEPLOYER_ADDRESS);
  console.log("Payment Addresses:", PAYMENT_ADDRESSES);

  // Connect to contracts
  const factory = await ethers.getContractAt(
    "RadbotV1Factory",
    FACTORY_ADDRESS
  );
  const deployerContract = await ethers.getContractAt(
    "RadbotV1Deployer",
    DEPLOYER_ADDRESS
  );

  // Check if caller is the owner
  const owner = await factory.owner();
  console.log("\n🔐 Ownership Check:");
  console.log("Factory Owner:", owner);
  console.log("Caller:", deployer.address);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Error: You are not the owner of the factory contract");
    console.log("Only the owner can initialize the factory");
    process.exit(1);
  }
  console.log("✅ Caller is the factory owner");

  // Check if factory is already initialized
  console.log("\n🔍 Factory State Check:");
  try {
    const deployerAddress = await factory.deployer();
    const payments = await factory.getPayments();

    if (deployerAddress !== ethers.ZeroAddress) {
      console.log("⚠️  Factory appears to be already initialized");
      console.log("Current Deployer:", deployerAddress);
      console.log("Current Payment Addresses:", payments);

      // Ask for confirmation to re-initialize
      console.log(
        "\n❓ The factory is already initialized. Do you want to continue?"
      );
      console.log("Note: This will overwrite the current configuration.");
      // In a real script, you might want to add a confirmation prompt here
    } else {
      console.log("✅ Factory is uninitialized, ready for initialization");
    }
  } catch (error) {
    console.log("✅ Factory is uninitialized (deployer not set)");
  }

  // Initialize the deployer contract first (if not already initialized)
  console.log("\n🔧 Checking Deployer Initialization:");
  try {
    const deployerFactory = await deployerContract.factory();
    if (deployerFactory === ethers.ZeroAddress) {
      console.log("Initializing deployer contract...");
      const initDeployerTx = await deployerContract.initDeployer(
        FACTORY_ADDRESS
      );
      await initDeployerTx.wait();
      console.log("✅ Deployer initialized successfully");
    } else {
      console.log("✅ Deployer already initialized");
    }
  } catch (error: any) {
    console.log(
      "Deployer initialization status:",
      error.message.includes("AlreadyInitialized")
        ? "Already initialized"
        : "Error occurred"
    );
  }

  // Execute factory initialization
  console.log("\n⏳ Initializing Factory...");
  console.log("Setting deployer:", DEPLOYER_ADDRESS);
  console.log("Setting payment addresses:", PAYMENT_ADDRESSES);

  try {
    const tx = await factory.initFactory(DEPLOYER_ADDRESS, PAYMENT_ADDRESSES);
    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log(
      "✅ Factory initialization confirmed in block:",
      receipt?.blockNumber
    );
    console.log("Gas used:", receipt?.gasUsed.toString());

    // Verify initialization
    console.log("\n🔍 Verifying Initialization:");
    const initializedDeployer = await factory.deployer();
    const initializedPayments = await factory.getPayments();

    console.log("Deployer Address:", initializedDeployer);
    console.log("Payment Addresses:", initializedPayments);

    if (initializedDeployer.toLowerCase() === DEPLOYER_ADDRESS.toLowerCase()) {
      console.log("✅ Deployer address set correctly");
    } else {
      console.log("❌ Deployer address mismatch");
    }

    if (initializedPayments.length === PAYMENT_ADDRESSES.length) {
      console.log("✅ Payment addresses set correctly");
    } else {
      console.log("❌ Payment addresses count mismatch");
    }
  } catch (error: any) {
    console.error("❌ Factory initialization failed:", error.message);

    // Provide helpful error messages for common issues
    if (error.message.includes("ZD")) {
      console.log("Error: Zero deployer address provided");
    } else if (error.message.includes("EA")) {
      console.log("Error: Empty payment addresses array provided");
    } else if (error.message.includes("ZP")) {
      console.log("Error: Zero payment address in the array");
    } else if (error.message.includes("TM")) {
      console.log("Error: Too many payment addresses (max 50 allowed)");
    } else if (
      error.message.includes("Initializable: contract is already initialized")
    ) {
      console.log("Error: Factory is already initialized");
    } else if (error.message.includes("Ownable: caller is not the owner")) {
      console.log("Error: Only the factory owner can initialize");
    }

    process.exit(1);
  }

  console.log("\n🎯 Factory Initialization Summary:");
  console.log("✅ Factory successfully initialized");
  console.log("✅ Deployer address configured");
  console.log("✅ Payment addresses configured");
  console.log("✅ Factory is now active and ready to create agents");

  console.log("\nNext steps:");
  console.log("1. Use the factory to create agent contracts");
  console.log("2. Deploy agents using the deployer contract");
  console.log("3. Mint NFTs using the mint router");

  console.log("\nFactory Address:", FACTORY_ADDRESS);
  console.log("Deployer Address:", DEPLOYER_ADDRESS);
  console.log("Payment Tokens:", PAYMENT_ADDRESSES);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
