const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    const electionName = "SecureVote 2026";
    const candidates = ["Alice", "Bob", "Charlie"];
    const symbols = ["🐘", "✋", "🧹"]; // Default emojis for now

    const Voting = await hre.ethers.getContractFactory("VotingSystem");
    const voting = await Voting.deploy(electionName, candidates, symbols);

    await voting.waitForDeployment();
    const address = await voting.getAddress();
    console.log(`✅ Contract deployed at: ${address}`);

    // Save the ABI and address for the frontend
    const artifactsPath = path.join(__dirname, '../frontend/src/utils');
    if (!fs.existsSync(artifactsPath)) {
        fs.mkdirSync(artifactsPath, { recursive: true });
    }

    const contractArtifact = artifacts.readArtifactSync("VotingSystem");

    fs.writeFileSync(
        path.join(artifactsPath, 'contractABI.json'),
        JSON.stringify(contractArtifact.abi, null, 2)
    );

    fs.writeFileSync(
        path.join(artifactsPath, 'contractAddress.json'),
        JSON.stringify({ address }, null, 2)
    );

    console.log(`✅ ABI and Address saved to frontend utils`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
