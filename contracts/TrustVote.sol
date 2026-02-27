// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ElectionSystem {
    // Structure to define a Candidate 
    struct Candidate {
        uint id;
        string name;
        string party;
        string constituency;
        uint boothId;
        uint voteCount;
    }

    // Mapping to store accounts that have already voted to prevent double voting 
    mapping(address => bool) public hasVoted;
    
    // Mapping to fetch a candidate by their ID
    mapping(uint => Candidate) public candidates;
    
    // Total number of candidates
    uint public candidatesCount;

    // The administrator who deploys the contract (e.g., the Election Commission)
    address public admin;

    // Event triggered when a vote is cast to notify the network [cite: 37]
    event VoteCast(uint indexed candidateId, address voter);

    constructor() {
        admin = msg.sender;
    }

    // Function to add candidates (Restricted to Admin)
    function addCandidate(string memory _name, string memory _party, string memory _constituency, uint _boothId) public {
        require(msg.sender == admin, "Only the admin can add candidates.");
        
        candidatesCount++;
        candidates[candidatesCount] = Candidate(
            candidatesCount, 
            _name, 
            _party, 
            _constituency, 
            _boothId, 
            0
        );
    }

    // Function for a voter to cast their vote
    function vote(uint _candidateId) public {
        // 1. Ensure they haven't voted already (One person, one vote) 
        require(!hasVoted[msg.sender], "Voter has already cast a vote.");
        
        // 2. Ensure the candidate ID is valid
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID.");

        // 3. Record that the voter has voted
        hasVoted[msg.sender] = true;

        // 4. Update candidate vote count (Automated tallying) 
        candidates[_candidateId].voteCount++;

        // 5. Emit the vote event
        emit VoteCast(_candidateId, msg.sender);
    }

    // Function to get the current vote count for a specific candidate
    function getVoteCount(uint _candidateId) public view returns (uint) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID.");
        return candidates[_candidateId].voteCount;
    }
}