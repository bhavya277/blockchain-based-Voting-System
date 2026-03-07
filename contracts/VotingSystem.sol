// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Decentralized Voting System (Relayer Edition)
/// @notice Perfect code for unique voting WITHOUT user wallets (MetaMask)
contract VotingSystem {
    string public electionName;
    address public admin;
    uint256 public candidatesCount;
    bool public votingEnded;
    uint256 public electionId;

    struct Candidate {
        uint256 id;
        string name;
        string partySymbol;
        uint256 voteCount;
    }
    
    mapping(uint256 => Candidate) public candidates;
    mapping(uint256 => mapping(bytes32 => bool)) public hasVotedInElection;

    event VoteCasted(uint256 indexed electionId, bytes32 indexed voterId, uint256 candidateId);
    event VotingEnded(uint256 indexed electionId);
    event NewElectionStarted(uint256 indexed electionId, string name);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only authorized relayer can submit votes");
        _;
    }

    constructor(string memory _electionName, string[] memory _candidateNames, string[] memory _partySymbols) {
        admin = msg.sender;
        electionId = 1;
        electionName = _electionName;
        
        require(_candidateNames.length == _partySymbols.length, "Names and symbols mismatch");
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            _addInternal(_candidateNames[i], _partySymbols[i]);
        }
    }

    function startNewElection(string memory _newName) public onlyAdmin {
        require(votingEnded, "Must end ongoing election first");
        electionId++;
        electionName = _newName;
        candidatesCount = 0;
        votingEnded = false;
        emit NewElectionStarted(electionId, _newName);
    }

    function addCandidate(string memory _name, string memory _symbol) public onlyAdmin {
        require(!votingEnded, "Cannot add candidates after voting has ended");
        _addInternal(_name, _symbol);
    }

    function _addInternal(string memory _name, string memory _symbol) internal {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, _symbol, 0);
    }

    function endVoting() public onlyAdmin {
        votingEnded = true;
        emit VotingEnded(electionId);
    }

    function vote(bytes32 _voterId, uint256 _candidateId) public onlyAdmin {
        require(!votingEnded, "Voting has ended.");
        require(!hasVotedInElection[electionId][_voterId], "Already voted in this election.");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate.");

        hasVotedInElection[electionId][_voterId] = true;
        candidates[_candidateId].voteCount++;

        emit VoteCasted(electionId, _voterId, _candidateId);
    }

    function getResults() public view returns (Candidate[] memory) {
        Candidate[] memory results = new Candidate[](candidatesCount);
        for (uint256 i = 1; i <= candidatesCount; i++) {
            results[i - 1] = candidates[i];
        }
        return results;
    }
}
