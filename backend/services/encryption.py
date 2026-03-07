import os
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from dotenv import load_dotenv

load_dotenv()

class EncryptionService:
    def __init__(self):
        # AES-256 requires a 32-byte key. 
        # We fetch it from .env or use a default (not recommended for production).
        key = os.getenv("AADHAAR_ENCRYPTION_KEY", "y6B8p2NqW4v9R1m5Z3x8c0vB2nM1p9L0")
        if len(key) < 32:
            # Pad key if too short or handle error
            self.key = key.ljust(32, '0')[:32].encode('utf-8')
        else:
            self.key = key[:32].encode('utf-8')

    def encrypt(self, plain_text: str) -> str:
        """
        Encrypts a string using AES-256 CBC Mode.
        Returns a base64 encoded string containing IV + Ciphertext.
        """
        if not plain_text: return ""
        
        cipher = AES.new(self.key, AES.MODE_CBC)
        ct_bytes = cipher.encrypt(pad(plain_text.encode('utf-8'), AES.block_size))
        
        # IV is needed for decryption, so we prepend it to the ciphertext
        iv = base64.b64encode(cipher.iv).decode('utf-8')
        ct = base64.b64encode(ct_bytes).decode('utf-8')
        
        return f"{iv}:{ct}"

    def decrypt(self, encrypted_text: str) -> str:
        """
        Decrypts a base64 encoded string using AES-256 CBC Mode.
        Expects format 'iv:ciphertext'
        """
        if not encrypted_text or ":" not in encrypted_text: return ""
        
        try:
            iv_b64, ct_b64 = encrypted_text.split(":")
            iv = base64.b64decode(iv_b64)
            ct = base64.b64decode(ct_b64)
            
            cipher = AES.new(self.key, AES.MODE_CBC, iv)
            pt = unpad(cipher.decrypt(ct), AES.block_size)
            return pt.decode('utf-8')
        except Exception as e:
            print(f"Decryption Error: {e}")
            return "DEC_ERROR"

# Singleton instance
encryptor = EncryptionService()
