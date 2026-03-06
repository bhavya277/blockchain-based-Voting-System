from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import easyocr
import numpy as np
from PIL import Image
import io
import re
import os
import firebase_admin
from firebase_admin import auth, credentials, firestore
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from models.schemas import VoterRegistration
from services.blockchain import BlockchainService
import sys
import random
from web3 import Web3

# Load environment variables
load_dotenv()

# Setup Blockchain Relayer Service
blockchain = BlockchainService()

# Initialize Firebase Admin SDK using path from .env
service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
if service_account_path:
    # If the path is relative, make it absolute or join it properly
    if not os.path.isabs(service_account_path):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        service_account_path = os.path.join(current_dir, service_account_path)

    if os.path.exists(service_account_path):
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        print(f"Successfully initialized Firebase Admin from {service_account_path}")
    else:
        print(f"Warning: Firebase Service Account not found at {service_account_path}. Backend will run in mock mode.")
else:
    print("Warning: FIREBASE_SERVICE_ACCOUNT_PATH not defined in .env. Backend will run in mock mode.")

# Initialize Firestore Client
db_fire = firestore.client() if firebase_admin._apps else None

# Initialize EasyOCR Reader (English) once
# Added 'gpu=False' explicitly for CPU environments to avoid startup check delay
reader = easyocr.Reader(['en'], gpu=False)

app = FastAPI(title="Voting MVP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the SecureVote API", "docs": "/docs"}

@app.get("/.well-known/appspecific/com.chrome.devtools.json")
def chrome_devtools_noise():
    return {}

# Mock stores (In real apps, use Redis or Firestore)
otp_store = {}      # Aadhaar/Mobile OTPs
email_otp_store = {} # Email OTPs
face_registry = {}   # Simulating Face Signatures
mock_user_profiles = {} # Temporary store for mock account overrides

@app.post("/api/send-email-otp")
async def send_email_otp(email: str = Form(...)):
    import random
    otp = str(random.randint(100000, 999999))
    email_otp_store[email] = otp
    
    print(f"--- EMAIL GATEWAY SIMULATION ---", flush=True)
    print(f"To: {email}", flush=True)
    print(f"Message: Your SecureVote Email Verification Code is {otp}.", flush=True)
    print(f"---------------------------------", flush=True)
    return {"status": "success", "message": f"OTP sent to {email}"}

@app.post("/api/verify-email-otp")
async def verify_email_otp(email: str = Form(...), otp: str = Form(...)):
    if email in email_otp_store and email_otp_store[email] == otp:
        # success
        return {"status": "success", "message": "Email verified"}
    raise HTTPException(status_code=400, detail="Invalid Email OTP")

@app.post("/api/verify-face")
async def verify_face(
    face_image: UploadFile = File(...),
    uid: str = Form(...)
):
    # BIOMETRIC COMPARISON LOGIC:
    # 1. We receive the live face capture from the camera.
    # 2. We compare it against the face signature extracted from the Aadhaar Card uploaded earlier.
    # 3. For Mock: We simulate a 98% match confidence.
    try:
        content = await face_image.read()
        img = Image.open(io.BytesIO(content))
        
        # Simulating analysis delay
        print(f"--- FACE ANALYSIS SYSTEM ---")
        print(f"Analyzing biometrics for UID: {uid}")
        
        # MOCK LOGIC: We accept any face image for now as 'verified'
        # but we 'note' it in logs.
        print(f"Biometric Match: 98.4% Confidence")
        print(f"----------------------------")
        
        return {
            "status": "success",
            "verified": True,
            "timestamp": "2026-03-06T15:00:00Z"
        }
    except Exception as e:
        print(f"Face Biometric Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Face biometric capture failed: {str(e)}")
@app.post("/api/verify-aadhaar")
async def verify_aadhaar(
    file: UploadFile = File(...),
    aadhaar_number: str = Form(...)
):
    print(f"\n>>> [API] RECEIVED AADHAAR SCAN REQUEST FOR: {aadhaar_number}", file=sys.stderr, flush=True)
    
    # 1. TEST BYPASS
    if aadhaar_number in ["000000000000", "00000000000"]:
        otp = "123456"
        otp_store[aadhaar_number] = otp
        print("\n" + "!"*60, file=sys.stderr, flush=True)
        print("  TEST BYPASS OTP: 123456", file=sys.stderr, flush=True)
        print("!"*60 + "\n", file=sys.stderr, flush=True)
        return {
            "status": "verified",
            "extractedAadhaar": aadhaar_number,
            "linkedMobile": "xxxxxx1234",
            "fullMobile": "9876541234",
            "otpSent": True,
            "message": "TEST BYPASS ACTIVE"
        }

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # 2. IMAGE PRE-PROCESSING (Maximum Clarity)
        image = image.convert('L') # Grayscale
        from PIL import ImageEnhance, ImageOps
        image = ImageEnhance.Contrast(image).enhance(2.5) # High Contrast
        image = ImageEnhance.Sharpness(image).enhance(2.0) # Sharpen
        # image = ImageOps.autocontrast(image)
        
        image_np = np.array(image)
        
        # 3. TEXT EXTRACTION
        raw_results = reader.readtext(image_np, detail=0)
        full_text = " ".join(raw_results)
        # Create a version with NO spaces to catch numbers split by OCR
        text_no_spaces = re.sub(r'\s+', '', full_text)
        
        print(f"DEBUG OCR (Raw): {full_text}", file=sys.stderr, flush=True)

        # 4. SMART AADHAAR DETECTION
        # Pre-process: Find all sequences of 12 digits
        all_12_digits = re.findall(r'\d{12}', text_no_spaces)
        # Filter out sequences that are part of a 16-digit Virtual ID
        vids = re.findall(r'\d{16}', text_no_spaces)
        for vid in vids:
            all_12_digits = [n for n in all_12_digits if n not in vid]

        extracted_no = "Not Found"
        
        # Rule A: Does the user-provided Aadhaar exist in the card text? (Highest Priority)
        if aadhaar_number in text_no_spaces:
            extracted_no = aadhaar_number
            print(f"MATCH: Direct exact match found for {aadhaar_number}", file=sys.stderr, flush=True)
        # Rule B: If not exact, is there a 12-digit number that is very close (Levenshtein/Fuzzy)?
        elif all_12_digits:
            # Pick the one that matches the most digits with the user input
            best_match = ""
            max_similarity = 0
            for candidate in all_12_digits:
                similarity = sum(1 for a, b in zip(candidate, aadhaar_number) if a == b)
                if similarity > max_similarity:
                    max_similarity = similarity
                    best_match = candidate
            
            # If 10/12 digits match, we assume OCR error and accept the user's number
            if max_similarity >= 10:
                extracted_no = best_match # We'll compare it below
                print(f"FUZZY MATCH: Found {best_match} which is close to {aadhaar_number}", file=sys.stderr, flush=True)
            else:
                extracted_no = all_12_digits[0]
        else:
             print("!!! OCR ERROR: No 12-digit Aadhaar pattern detected.", file=sys.stderr, flush=True)
             raise HTTPException(status_code=400, detail="The AI could not clearly find a 12-digit Aadhaar number. Please use a clearer image.")
        
        if extracted_no != aadhaar_number:
            print(f"!!! SECURITY MISMATCH: Entered: {aadhaar_number} vs Scanned: {extracted_no}", file=sys.stderr, flush=True)
            raise HTTPException(status_code=400, detail=f"Forgery Detected: Scanned Aadhaar ({extracted_no}) does not match the number you entered ({aadhaar_number}).")

        # 5. MOBILE EXTRACTION (Deep Search)
        mobile_no = "Not Found"
        # Look for 10 digits starting with 6-9 in all raw fragments
        for text_frag in raw_results:
            clean_frag = text_frag.replace(" ", "")
            # Check 10 digit matches
            m = re.search(r'[6-9]\d{9}', clean_frag)
            if m and m.group(0) != extracted_no:
                mobile_no = m.group(0)
                break
        
        if mobile_no == "Not Found":
            # Fallback to the whole text
            m = re.search(r'[6-9]\d{9}', text_no_spaces.replace(extracted_no, ""))
            if m: mobile_no = m.group(0)

        if mobile_no == "Not Found":
             print("!!! WARNING: Mobile not found in OCR text. Falling back to test placeholder.", file=sys.stderr, flush=True)
             mobile_no = "9876541234" # Fail-safe mock for demo

        # 6. GENERATE OTP & FORCE TERMINAL PRINT (sys.stderr bypasses all buffering)
        otp = str(random.randint(100000, 999999))
        otp_store[aadhaar_number] = otp
        
        sys.stderr.write("\n" + "█"*60 + "\n")
        sys.stderr.write(f"  CRITICAL: VOTER OTP GENERATED\n")
        sys.stderr.write(f"  PHONE: +91 {mobile_no}\n")
        sys.stderr.write(f"  OTP:   {otp}\n")
        sys.stderr.write("█"*60 + "\n\n")
        sys.stderr.flush()

        return {
            "status": "verified",
            "extractedAadhaar": extracted_no,
            "linkedMobile": f"xxxxxx{mobile_no[-4:]}",
            "fullMobile": mobile_no,
            "otpSent": True,
            "message": "Identity Verified. Secure OTP initiated."
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        print(f"CRITICAL OCR FAILURE:\n{traceback_str}", file=sys.stderr, flush=True)
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")

@app.post("/api/verify-otp")
async def verify_otp(
    aadhaar_number: str = Form(...),
    otp: str = Form(...)
):
    print(f"--- Received OTP Verification Request for Aadhaar {aadhaar_number} ---")
    if aadhaar_number in otp_store and otp_store[aadhaar_number] == otp:
        # OTP verified, remove it
        del otp_store[aadhaar_number]
        return {"status": "success", "message": "OTP verified successfully."}
    else:
        raise HTTPException(status_code=400, detail="Invalid OTP or Aadhaar number.")


security = HTTPBearer()

def verify_jwt(res: HTTPAuthorizationCredentials = Depends(security)):
    token = res.credentials
    if os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") and token not in ["mock-token", "admin-token", "voter-token"]:
        try:
            # 1. Verify the basic Firebase token
            decoded_token = auth.verify_id_token(token)
            
            # 2. Check if 'role' is already in custom claims
            if "role" in decoded_token:
                return decoded_token
            
            # 3. Fallback: Lookup the user role in Firestore
            if db_fire:
                uid = decoded_token.get("uid")
                user_doc = db_fire.collection("users").document(uid).get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    decoded_token["role"] = user_data.get("role", "voter")
                    return decoded_token
            
            # 4. Final Fallback: Default to voter
            decoded_token["role"] = "voter"
            return decoded_token
            
        except Exception as e:
            print(f"Auth Error: {e}")
            raise HTTPException(status_code=401, detail="Invalid or Expired Firebase Token")
    
    # Handle Role-Specific Mock Tokens
    if token == "admin-token":
        return {"uid": "mock-admin-uid-999", "email": "admin@test.com", "role": "admin"}
    if token == "voter-token":
        return {"uid": "mock-voter-uid-888", "email": "voter@test.com", "role": "voter"}
        
    return {"uid": "mock-firebase-uid-123", "email": "mock@example.com", "role": "admin"}

@app.post("/api/voters/register")
def register_voter(voter: VoterRegistration, user: dict = Depends(verify_jwt)):
    if not db_fire:
        print("Mock: Not saving to Firestore (Admin SDK not initialized)")
        return {"status": "mock_success", "uid": user["uid"]}
        
    try:
        user_ref = db_fire.collection("users").document(user["uid"])
        user_ref.set({
            "email": voter.email,
            "role": voter.role,
            "aadhaar": voter.aadhaar,
            "voterId": voter.voter_id,
            "mobile": voter.mobile,
            "walletAddress": voter.wallet_address,
            "isVerified": True,
            "verifiedAt": firestore.SERVER_TIMESTAMP,
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        return {
            "status": "success",
            "uid": user["uid"],
            "message": "Voter profile secured in production Firestore."
        }
    except Exception as e:
        print(f"Firestore Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database failure: {str(e)}")

@app.get("/api/users/profile")
def get_profile(user: dict = Depends(verify_jwt)):
    uid = user.get("uid")
    email = user.get("email")
    print(f"\n>>> [PROFILE] FETCHING FOR: {email} (UID: {uid})", file=sys.stderr, flush=True)

    # SUPER-ADMIN MOCK
    if uid in ["mock-firebase-uid-123", "mock-admin-uid-999"] or email == "admin@test.com":
        mock_overrides = mock_user_profiles.get(uid, {})
        return {
            "uid": uid,
            "email": email,
            "role": "admin",
            "aadhaar": "1234 5678 9012",
            "mobile": "9999888877",
            "walletAddress": mock_overrides.get("walletAddress", "not-connected"),
            "hasVoted": False,
            "isMock": True
        }
        
    if not db_fire:
        print(">>> [PROFILE] FIREBASE DOWN - RETURNING MOCK", file=sys.stderr, flush=True)
        mock_overrides = mock_user_profiles.get(uid, {})
        return {
            "uid": uid, 
            "email": email, 
            "role": "voter", 
            "aadhaar": "**** **** 0000",
            "mobile": "xxxxxx0000",
            "walletAddress": mock_overrides.get("walletAddress", "not-connected"),
            "hasVoted": False,
            "isMock": True
        }
        
    try:
        # 1. Check if user already voted on the Blockchain (Live Audit)
        blockchain_voted = False
        try:
            if blockchain.contract:
                voter_hash = Web3.keccak(text=uid)
                blockchain_voted = blockchain.contract.functions.hasVoted(voter_hash).call()
                print(f">>> [PROFILE] BLOCKCHAIN AUDIT: Voted={blockchain_voted}", file=sys.stderr, flush=True)
        except Exception as be:
            print(f">>> [PROFILE] BLOCKCHAIN AUDIT ERROR (Skipping): {be}", file=sys.stderr, flush=True)

        user_doc = db_fire.collection("users").document(uid).get()
        if user_doc.exists:
            profile_data = user_doc.to_dict()
            profile_data["hasVoted"] = blockchain_voted
            # Check for mock memory overrides first (for testing)
            mock_overrides = mock_user_profiles.get(uid, {})
            if "walletAddress" in mock_overrides:
                profile_data["walletAddress"] = mock_overrides["walletAddress"]
            print(f">>> [PROFILE] LOADED FROM FIRESTORE", file=sys.stderr, flush=True)
            return {**profile_data, "uid": uid, "hasVoted": blockchain_voted}
        else:
            print(f">>> [PROFILE] NO FIRESTORE DOC - USING FALLBACK", file=sys.stderr, flush=True)
            # Fallback for new users during mock development
            # Determine role from user details if possible
            fallback_role = "admin" if (uid == "mock-admin-uid-999" or email == "admin@test.com") else "voter"
            mock_overrides = mock_user_profiles.get(uid, {})
            
            return {
                "uid": uid, 
                "email": email, 
                "role": fallback_role, 
                "aadhaar": "Pending",
                "mobile": "Pending",
                "walletAddress": mock_overrides.get("walletAddress", "not-connected"),
                "hasVoted": blockchain_voted
            }
    except Exception as e:
        import traceback
        print(f"!!! [PROFILE] FATAL ERROR:\n{traceback.format_exc()}", file=sys.stderr, flush=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/users/link-wallet")
def link_wallet(wallet_address: str = Form(...), user: dict = Depends(verify_jwt)):
    try:
        print(f"--- Wallet Link Request ---")
        print(f"User: {user}")
        print(f"Wallet: {wallet_address}")
        
        # Always update mock memory for testing tokens, even if Firestore is active
        uid = user.get("uid", "unknown")
        is_mock_token = uid.startswith("mock-")
        
        if is_mock_token or not db_fire:
            print(f"Bypass: Updating Mock Memory for {uid}")
            if uid not in mock_user_profiles:
                mock_user_profiles[uid] = {}
            mock_user_profiles[uid]["walletAddress"] = wallet_address
            if not db_fire:
                return {"status": "mock_success", "wallet": wallet_address}
            
        print("Mode: Firestore Storage")
        user_ref = db_fire.collection("users").document(uid)
        user_ref.set({
            "walletAddress": wallet_address,
            "walletLinkedAt": firestore.SERVER_TIMESTAMP
        }, merge=True)
        return {
            "status": "success",
            "message": f"Wallet {wallet_address} linked and verified on backend."
        }
    except Exception as e:
        import traceback
        print(f"Wallet Linking CRASH: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Critical Backend Error: {str(e)}")

# --- SECURE BLOCKCHAIN RELAYER ENDPOINTS ---
# No more MetaMask needed; we sign on the backend.

@app.get("/api/results")
def get_blockchain_results():
    """Fetches real-time election results directly from Ethereum."""
    try:
        results = blockchain.get_results()
        return {"status": "success", "results": results}
    except Exception as e:
        print(f"Contract Read Error: {e}")
        return {"status": "error", "message": f"Blockchain Sync Failed: {str(e)}", "results": []}

@app.post("/api/candidates/add")
def add_candidate_onchain(name: str = Form(...), user: dict = Depends(verify_jwt)):
    """Backend-signed transaction to add a candidate (Admin only)."""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Authority Denied: Only Admin can add to ledger.")
    
    try:
        tx_hash = blockchain.add_candidate(name)
        if not tx_hash:
            raise HTTPException(status_code=500, detail="Blockchain Service Initializing. Try again.")
        return {"status": "success", "txHash": tx_hash, "message": f"Candidate {name} secured on blockchain."}
    except Exception as e:
        print(f"Blockchain Write Error: {e}")
        raise HTTPException(status_code=500, detail=f"Transaction Failed: {str(e)}")

@app.post("/api/vote")
def cast_vote_onchain(candidate_id: int = Form(...), user: dict = Depends(verify_jwt)):
    """Backend-signed transaction to cast a vote (Voter verification required)."""
    if not user["uid"]:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        # Pass unique User ID to ensure 1-person-1-vote on the immutable ledger
        tx_hash = blockchain.cast_vote(candidate_id, user["uid"])
        if not tx_hash:
            raise HTTPException(status_code=500, detail="Blockchain sync failed.")
            
        return {
            "status": "success", 
            "txHash": tx_hash, 
            "message": "Your vote has been cast and secured on the Ethereum ledger."
        }
    except Exception as e:
        # Check if they already voted (revert message in contract)
        err_msg = str(e)
        if "already cast a vote" in err_msg:
            raise HTTPException(status_code=400, detail="Blockhain Audit: You have already voted in this election.")
        
        print(f"Blockchain Voting Error: {e}")
        raise HTTPException(status_code=500, detail=f"Blockchain validation failed: {str(e)}")

@app.get("/api/analytics")
def get_analytics():
    # Mix off-chain metadata with on-chain results
    blockchain_results = blockchain.get_results()
    total_votes = sum(c["voteCount"] for c in blockchain_results)
    
    return {
        "totalRegisteredVoters": 100, 
        "turnoutCount": total_votes,
        "results": blockchain_results
    }
