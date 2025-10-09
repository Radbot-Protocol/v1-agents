import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RadbotV1DeployerModule = buildModule("RadbotV1DeployerModule", (m) => {
  const radbotV1Deployer = m.contract("RadbotV1Deployer");

  return {
    radbotV1Deployer,
  };
});

export default RadbotV1DeployerModule;

//0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 USDC
