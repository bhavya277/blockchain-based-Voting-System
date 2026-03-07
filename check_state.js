const hre = require("hardhat");
const contractAddress = require("./frontend/src/utils/contractAddress.json").address;

async function main() {
    const Voting = await hre.ethers.getContractFactory("VotingSystem");
    const voting = await Voting.attach(contractAddress);

    const count = await voting.candidatesCount();
    console.log("Candidates Count:", count.toString());

    const name = await voting.electionName();
    console.log("Election Name:", name);

    for (let i = 1; i <= count; i++) {
        const c = await voting.candidates(i);
        console.log(`Candidate ${i}: ${c.name} (${c.symbol ? c.symbol.substring(0, 30) + '...' : 'no symbol'})`);
    }
}

main().catch(console.error);
