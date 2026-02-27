const hre = require("hardhat");

async function main() {
  // TrustVote contract address (update if different)
  const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

  // ABI for the original ElectionSystem contract
  const CONTRACT_ABI = [
    "function candidatesCount() view returns (uint256)",
    "function candidates(uint256) view returns (uint id, string name, string party, string constituency, uint boothId, uint voteCount)",
    "function addCandidate(string _name, string _party, string _constituency, uint _boothId) nonpayable",
    "function vote(uint _candidateId) nonpayable"
  ];

  const provider = new hre.ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const contract = new hre.ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  // Get current candidate count
  try {
    const count = await contract.candidatesCount();
    console.log(`Current candidates count: ${count}`);

    if (count === 0n) {
      console.log("Adding candidates to the election...");
      
      // Use the first account as admin
      const signer = await provider.getSigner(0);
      const adminContract = contract.connect(signer);
      
      const candidates = [
        { name: "Alice Sharma", party: "Tech Party", constituency: "North District", boothId: 1 },
        { name: "Bob Singh", party: "Devs United", constituency: "South District", boothId: 2 },
        { name: "Charlie Kumar", party: "Innovation Party", constituency: "East District", boothId: 3 },
      ];

      for (const candidate of candidates) {
        const tx = await adminContract.addCandidate(
          candidate.name,
          candidate.party,
          candidate.constituency,
          candidate.boothId
        );
        await tx.wait();
        console.log(`Added candidate: ${candidate.name} (${candidate.party})`);
      }
      console.log("All candidates added successfully!");
    } else {
      console.log("Candidates already exist, listing them...");
    }

    // List all candidates
    const newCount = await contract.candidatesCount();
    console.log(`\nTotal candidates: ${newCount}`);
    
    for (let i = 1n; i <= newCount; i++) {
      const candidate = await contract.candidates(i);
      console.log(`${i}. ${candidate.name} - ${candidate.party} (${candidate.constituency}) - ${candidate.voteCount} votes`);
    }
  } catch (error) {
    console.error("Error:", error.message);
    console.log("\nMake sure Hardhat node is running: npx hardhat node");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
