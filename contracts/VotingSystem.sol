// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Decentralized Voting System (Relayer Edition)
/// @notice Perfect code for unique voting WITHOUT user wallets (MetaMask)
contract VotingSystem {
    string public electionName;
    address public admin;

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    mapping(uint256 => Candidate) public candidates;
    uint256 public candidatesCount;
    
    // Security: Uniqueness tracked by Unique Voter ID (Aadhaar/UID Hash)
    // This allows the backend to relay votes while ensuring each human only votes once.
    mapping(bytes32 => bool) public hasVoted;

    event VoteCasted(bytes32 indexed voterId, uint256 candidateId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only authorized relayer can submit votes");
        _;
    }

    constructor(string memory _electionName, string[] memory _candidateNames) {
        admin = msg.sender; // The backend relayer's address
        electionName = _electionName;
        
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            _addInternal(_candidateNames[i]);
        }
    }

    function addCandidate(string memory _name) public onlyAdmin {
        _addInternal(_name);
    }

    function _addInternal(string memory _name) internal {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
    }

    /// @notice Core voting function (Relayer signs this)
    /// @param _voterId The unique hash of the voter's identity (e.g., keccak256(aadhaar))
    function vote(bytes32 _voterId, uint256 _candidateId) public onlyAdmin {
        // Security checks
        require(!hasVoted[_voterId], "This identity has already cast a vote.");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate selection.");

        // State modifications
        hasVoted[_voterId] = true;
        candidates[_candidateId].voteCount++;

        // Event emission for transparency
        emit VoteCasted(_voterId, _candidateId);
    }

    /// @notice Returns all candidates for frontend mapping
    function getResults() public view returns (Candidate[] memory) {
        Candidate[] memory results = new Candidate[](candidatesCount);
        for (uint256 i = 1; i <= candidatesCount; i++) {
            results[i - 1] = candidates[i];
        }
        return results;
    }
}
