import os
import json
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

load_dotenv()

class BlockchainService:
    def __init__(self):
        # 1. Connect to Local Hardhat Node
        self.rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        # 2. Setup Private Key (Relayer / Centralized Admin)
        # Using Account #0 from Hardhat as default admin
        self.private_key = os.getenv("ADMIN_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
        self.account = Account.from_key(self.private_key)
        
        # 3. Load Contract
        self.contract_address = self._load_contract_address()
        self.contract_abi = self._load_contract_abi()
        
        if self.contract_address and self.contract_abi:
            self.contract = self.w3.eth.contract(address=self.contract_address, abi=self.contract_abi)
        else:
            self.contract = None
            print("Warning: Blockchain Contract not initialized. Check frontend/src/utils/ paths.")

    def _load_contract_address(self):
        try:
            # Re-join properly from absolute directory for python backend context
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            path = os.path.join(project_root, "frontend/src/utils/contractAddress.json")
            if not os.path.exists(path): return None
            with open(path, 'r') as f:
                return json.load(f)["address"]
        except:
            return None

    def _load_contract_abi(self):
        try:
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            path = os.path.join(project_root, "frontend/src/utils/contractABI.json")
            if not os.path.exists(path): return None
            with open(path, 'r') as f:
                return json.load(f)
        except:
            return None

    def is_connected(self):
        return self.w3.is_connected()

    def add_candidate(self, name: str):
        if not self.contract: return None
        
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        txn = self.contract.functions.addCandidate(name).build_transaction({
            'chainId': 31337,
            'gas': 2000000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': nonce,
        })
        
        signed_txn = self.w3.eth.account.sign_transaction(txn, private_key=self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        return self.w3.to_hex(tx_hash)

    def cast_vote(self, candidate_id: int, voter_uid: str):
        """
        Uses Relayer logic to cast a vote on-chain for a specific User ID.
        This provides a 'MetaMask-less' experience while keeping blockchain auditability.
        """
        if not self.contract: return None
        
        # Convert UID to bytes32 for blockchain storage
        voter_id_bytes = Web3.keccak(text=voter_uid)
        
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        txn = self.contract.functions.vote(voter_id_bytes, candidate_id).build_transaction({
            'chainId': 31337,
            'gas': 2000000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': nonce,
        })
        
        signed_txn = self.w3.eth.account.sign_transaction(txn, private_key=self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        return self.w3.to_hex(tx_hash)

    def get_results(self):
        if not self.contract: 
            self.contract_address = self._load_contract_address()
            self.contract_abi = self._load_contract_abi()
            if self.contract_address and self.contract_abi:
                self.contract = self.w3.eth.contract(address=self.contract_address, abi=self.contract_abi)
        
        if not self.contract: return []
        
        try:
            results = self.contract.functions.getResults().call()
            return [
                {"id": r[0], "name": r[1], "voteCount": r[2]}
                for r in results
            ]
        except Exception as e:
            print(f"Contract Call Error: {e}")
            return []
