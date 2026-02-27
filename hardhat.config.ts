import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20", // Explicitly matching your TrustVote.sol pragma
  networks: {
    hardhat: {
      type: "edr-simulated" // Fixes the HHE15 simulator requirement
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      type: "http" // Fixes the HHE15 localhost node requirement
    }
  }
};

export default config;