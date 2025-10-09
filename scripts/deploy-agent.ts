import { network } from "hardhat";
import {
  stringToBytes32,
  stringToBytes16,
} from "../test/__typescript__/helpers/string-helpers.js";

const { ethers } = await network.connect({
  network: "base",
  chainType: "op",
});

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Factory contract address (from ignition deployments)
  const FACTORY_ADDRESS = "0xF0F2114E9dd565362456b7450E035846EFaE18DD";
  console.log("Factory address:", FACTORY_ADDRESS);

  // Connect to the Factory contract
  const factory = await ethers.getContractAt(
    "RadbotV1Factory",
    FACTORY_ADDRESS
  );

  // Agent parameters
  const agentParams = {
    name: "Uper Agent",
    symbol: "UPER",
    description: "AI-powered trading agent",
    owner: deployer.address,
    baseURI:
      "https://salmon-obliged-bison-586.mypinata.cloud/ipfs/bafybeigacg4tcpflyxyfv2wk5gk7yu3asfqudwsydbjgjanmuxlt3kyeiu/",
    royalty: 500, // 5%
    maxAgents: 12,
    mintPrice: ethers.parseUnits("0.0005", 6), // 0.0005 USDC (6 decimals)
  };

  console.log("\n🚀 Creating agent with parameters:");
  console.log("Name:", agentParams.name);
  console.log("Symbol:", agentParams.symbol);
  console.log("Description:", agentParams.description);
  console.log("Owner:", agentParams.owner);
  console.log("Base URI:", agentParams.baseURI);
  console.log("Royalty:", agentParams.royalty, "basis points (5%)");
  console.log("Max Agents:", agentParams.maxAgents);
  console.log(
    "Mint Price:",
    ethers.formatUnits(agentParams.mintPrice, 6),
    "USDC"
  );

  // Convert strings to required byte formats
  const nameBytes32 = stringToBytes32(agentParams.name);
  const symbolBytes16 = stringToBytes16(agentParams.symbol);

  console.log("\n📝 Converted parameters:");
  console.log("Name (bytes32):", nameBytes32);
  console.log("Symbol (bytes16):", symbolBytes16);

  // Check if agent already exists
  const existingAgent = await factory.getAgent(
    nameBytes32,
    symbolBytes16,
    agentParams.maxAgents
  );
  if (existingAgent !== ethers.ZeroAddress) {
    console.log("⚠️  Agent already exists at:", existingAgent);
    console.log("Skipping deployment...");
    return;
  }

  // Call createAgent function on the factory
  console.log("\n⏳ Calling createAgent on factory...");
  const tx = await factory.createAgent(
    agentParams.owner,
    agentParams.maxAgents,
    nameBytes32,
    symbolBytes16,
    agentParams.description,
    agentParams.baseURI,
    agentParams.mintPrice,
    agentParams.royalty
  );

  console.log("Transaction sent:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
  console.log("Gas used:", receipt?.gasUsed.toString());

  // Get the agent address
  const agentAddress = await factory.getAgent(
    nameBytes32,
    symbolBytes16,
    agentParams.maxAgents
  );
  console.log("\n🎉 Agent created at:", agentAddress);

  // Verify the agent
  const agent = await ethers.getContractAt("RadbotV1Agent", agentAddress);
  const agentName = await agent.name();
  const agentSymbol = await agent.symbol();
  const agentOwner = await agent.owner();
  const agentMaxAgents = await agent.maxAgents();
  const agentFactory = await agent.factory();

  console.log("\n✅ Agent verification:");
  console.log("Name:", agentName);
  console.log("Symbol:", agentSymbol);
  console.log("Owner:", agentOwner);
  console.log("Max Agents:", agentMaxAgents.toString());
  console.log("Factory:", agentFactory);

  // Test tokenURI generation (should generate 1.png for token ID 1)
  console.log("\n🖼️  Testing tokenURI generation:");
  try {
    // Note: This will fail if no tokens are minted yet, but shows the expected URL structure
    const expectedImageUrl = `${agentParams.baseURI}1.png`;
    console.log("Expected image URL for token 1:", expectedImageUrl);
    console.log("This should match your IPFS file structure");
  } catch (error) {
    console.log("Note: Token URI can only be generated after minting");
  }

  console.log("\n🎯 Agent Creation Summary:");
  console.log("Agent Address:", agentAddress);
  console.log("Factory Address:", FACTORY_ADDRESS);
  console.log("\nNext steps:");
  console.log("1. Mint tokens using the MintRouter");
  console.log("2. Verify token URIs point to correct IPFS images");
  console.log("3. Test the complete minting flow");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
