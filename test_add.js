const hre = require("hardhat");
const contractAddress = require("./frontend/src/utils/contractAddress.json").address;

async function main() {
    const Voting = await hre.ethers.getContractFactory("VotingSystem");
    const voting = await Voting.attach(contractAddress);

    const name = "Test Candidate";
    const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; // 1x1 green png

    console.log("Adding candidate...");
    const tx = await voting.addCandidate(name, logo);
    await tx.wait();
    console.log("Candidate added! Hash:", tx.hash);

    const count = await voting.candidatesCount();
    console.log("New Candidates Count:", count.toString());
}

main().catch(console.error);
