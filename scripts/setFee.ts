import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "base",
  chainType: "op",
});

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Setting fee with account:", deployer.address);

  // Deployed contract addresses (from ignition deployments)
  const DEPLOYER_ADDRESS = "0x63C4e8DcB95149acdAAbDB6C4bA1391Fe90ab0b5";

  // Fee configuration - you can customize these values
  const NEW_FEE_USDC = "0.0005"; // Set to 1.0 USDC (you can change this)
  const NEW_FEE_WEI = ethers.parseUnits(NEW_FEE_USDC, 6); // Convert to wei (USDC has 6 decimals)

  console.log("\n📋 Fee Configuration:");
  console.log("Deployer Address:", DEPLOYER_ADDRESS);
  console.log("New Fee:", NEW_FEE_USDC, "USDC");
  console.log("New Fee (wei):", NEW_FEE_WEI.toString());

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
    console.log("Only the owner can set the fee");
    process.exit(1);
  }
  console.log("✅ Caller is the deployer owner");

  // Check current fee
  console.log("\n💰 Current Fee Check:");
  try {
    const currentFee = await deployerContract.fee();
    const currentFeeUSDC = ethers.formatUnits(currentFee, 6);

    console.log("Current Fee (wei):", currentFee.toString());
    console.log("Current Fee (USDC):", currentFeeUSDC);

    if (currentFee.toString() === NEW_FEE_WEI.toString()) {
      console.log("⚠️  Fee is already set to the desired value");
      console.log("No action needed");
      return;
    }

    console.log(`\n📊 Fee Change Summary:`);
    console.log(`From: ${currentFeeUSDC} USDC`);
    console.log(`To: ${NEW_FEE_USDC} USDC`);
  } catch (error: any) {
    console.log("Could not retrieve current fee:", error.message);
  }

  // Verify deployer is initialized
  console.log("\n🔍 Deployer State Check:");
  try {
    const factory = await deployerContract.factory();
    if (factory === ethers.ZeroAddress) {
      console.error("❌ Error: Deployer is not initialized");
      console.log(
        "Please initialize the deployer first using init-deployer.ts"
      );
      process.exit(1);
    }
    console.log("✅ Deployer is initialized");
    console.log("Factory Address:", factory);
  } catch (error: any) {
    console.log("Deployer initialization status:", error.message);
  }

  // Execute fee update
  console.log("\n⏳ Setting New Fee...");
  console.log("New Fee:", NEW_FEE_USDC, "USDC");

  try {
    const tx = await deployerContract.setFee(NEW_FEE_WEI);
    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Fee update confirmed in block:", receipt?.blockNumber);
    console.log("Gas used:", receipt?.gasUsed.toString());

    // Verify fee update
    console.log("\n🔍 Verifying Fee Update:");
    const updatedFee = await deployerContract.fee();
    const updatedFeeUSDC = ethers.formatUnits(updatedFee, 6);

    console.log("Updated Fee (wei):", updatedFee.toString());
    console.log("Updated Fee (USDC):", updatedFeeUSDC);

    if (updatedFee.toString() === NEW_FEE_WEI.toString()) {
      console.log("✅ Fee updated successfully");
    } else {
      console.log("❌ Fee update failed");
      console.log("Expected:", NEW_FEE_WEI.toString());
      console.log("Got:", updatedFee.toString());
    }
  } catch (error: any) {
    console.error("❌ Fee update failed:", error.message);

    // Provide helpful error messages for common issues
    if (error.message.includes("Ownable: caller is not the owner")) {
      console.log("Error: Only the deployer owner can set the fee");
    } else if (error.message.includes("DeployerV1_NotInitialized")) {
      console.log("Error: Deployer must be initialized before setting fee");
    }

    process.exit(1);
  }

  console.log("\n🎯 Fee Update Summary:");
  console.log("✅ Deployer fee successfully updated");
  console.log("✅ New fee:", NEW_FEE_USDC, "USDC");
  console.log("✅ Fee is now active for all future deployments");

  console.log("\nNext steps:");
  console.log("1. Test the fee by deploying an agent");
  console.log("2. Verify fee collection works correctly");
  console.log("3. Monitor fee payments in your wallet");

  console.log("\nDeployer Address:", DEPLOYER_ADDRESS);
  console.log("Current Fee:", NEW_FEE_USDC, "USDC");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
