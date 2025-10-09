import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RadbotV1FactoryModule = buildModule("RadbotV1FactoryModule", (m) => {
  const radbotV1Factory = m.contract("RadbotV1Factory");

  return {
    radbotV1Factory,
  };
});

export default RadbotV1FactoryModule;

//0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 USDC
