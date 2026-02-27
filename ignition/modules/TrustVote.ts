import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TrustVoteModule = buildModule("TrustVoteModule", (m) => {
  const deployer = m.getAccount(0);

  // We are forcing Hardhat to look at the exact file path here
  const trustVote = m.contract("contracts/TrustVote.sol:TrustVote", [deployer]);

  return { trustVote };
});

export default TrustVoteModule;