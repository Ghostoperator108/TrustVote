const hre = require("hardhat");

async function main() {
  console.log("Deploying ElectionSystem...");

  // Fetch the compiled contract
  const ElectionSystem = await hre.ethers.getContractFactory("ElectionSystem");
  
  // Deploy the contract to the network
  const election = await ElectionSystem.deploy();

  // Wait for the deployment to finish
  await election.waitForDeployment();

  console.log(`ElectionSystem deployed successfully to: ${election.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});