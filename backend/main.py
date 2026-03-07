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
from services.biometric_service import BiometricService
import sys
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from web3 import Web3

# Load environment variables
load_dotenv()

# Setup Blockchain Relayer Service
blockchain = BlockchainService()
biometric = BiometricService()

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

from pydantic import BaseModel
class AdminCreateUserRequest(BaseModel):
    email: str
    password: str
    aadhaar: str
    role: str = "voter"

@app.get("/.well-known/appspecific/com.chrome.devtools.json")
def chrome_devtools_noise():
    return {}

# Mock stores (In real apps, use Redis or Firestore)
otp_store = {}      # Aadhaar/Mobile OTPs
email_otp_store = {} # Email OTPs
face_registry = {}   # Simulating Face Signatures
mock_user_profiles = {} # Temporary store for mock account overrides
registered_aadhaars = {} # Full Aadhaar -> email mapping (Session persistence)

@app.post("/api/send-email-otp")
async def send_email_otp(email: str = Form(...)):
    otp = str(random.randint(100000, 999999))
    email_otp_store[email] = otp
    
    success = send_real_email(
        to_email=email,
        subject="SecureVote: Email Verification Code",
        body=f"Your SecureVote Email Verification Code is: {otp}. Do not share this with anyone."
    )
    
    if success:
        return {"status": "success", "message": f"OTP sent to your email ({email})"}
    else:
        # Fallback to terminal if SMTP not configured, but inform user
        print(f"\n[GATEWAY ERROR] Could not send email via SMTP. Check .env credentials.")
        print(f"To: {email} | OTP: {otp}\n")
        return {"status": "warning", "message": "Email service down. Check terminal for OTP (Dev Mode)."}

def send_real_email(to_email, subject, body):
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")

    if not smtp_user or not smtp_pass:
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False

def send_real_sms(to_mobile, body):
    sid = os.getenv("TWILIO_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_no = os.getenv("TWILIO_PHONE_NUMBER")

    if not sid or not token or not from_no:
        return False

    try:
        from twilio.rest import Client
        # Ensure number has +91 or + prefix
        target = to_mobile if to_mobile.startswith("+") else (to_mobile if to_mobile.startswith("+91") else f"+91{to_mobile}")
        client = Client(sid, token)
        message = client.messages.create(
            body=body,
            from_=from_no,
            to=target
        )
        return True
    except Exception as e:
        sys.stderr.write(f"\n[!!] TWILIO GATEWAY ERROR: {str(e)}\n")
        sys.stderr.flush()
        return False

@app.post("/api/verify-email-otp")
async def verify_email_otp(email: str = Form(...), otp: str = Form(...)):
    if email in email_otp_store and email_otp_store[email] == otp:
        # success
        return {"status": "success", "message": "Email verified"}
    raise HTTPException(status_code=400, detail="Invalid Email OTP")

@app.post("/api/biometric/register")
async def register_biometric(
    face_image: str = Form(...),
    uid: str = Form(...)
):
    try:
        success = biometric.register_biometric(uid, face_image)
        return {"status": "success", "message": "Biometric registered"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/verify-face")
async def verify_face(
    face_image: str = Form(...),
    uid: str = Form(...)
):
    try:
        result = biometric.verify_biometric(uid, face_image)
        if result["status"] == "success" and result["verified"]:
            return {
                "status": "success",
                "verified": True,
                "liveness": result["liveness"]
            }
        else:
            raise HTTPException(status_code=401, detail=result.get("message", "Face match failed"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/biometric/continuous-verify")
async def continuous_verify(
    face_image: str = Form(...),
    uid: str = Form(...)
):
    """Lightning-fast liveness (Retina) check for 1-second pulses"""
    try:
        # We use check_liveness for high frequency updates
        # This is much faster than verify_biometric because it skips DeepFace comparison
        result = biometric.check_liveness(face_image, uid)
        
        # We can occasionally inject a full identity check if we want, 
        # but for performance, basic liveness + retina-hash is better for high-frequency.
        return {
            "status": result["status"],
            "verified": result["status"] == "success", # In continuous mode, status success = verified presence
            "liveness": result.get("liveness", 0),
            "retina_hash": result.get("retina_hash", "N/A")
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
@app.post("/api/verify-aadhaar")
async def verify_aadhaar(
    file: UploadFile = File(...),
    aadhaar_number: str = Form(...)
):
    print(f"\n>>> [API] RECEIVED AADHAAR SCAN REQUEST FOR: {aadhaar_number}", file=sys.stderr, flush=True)
    
    # NEW: Aadhaar Uniqueness Check (Catch duplicates early)
    if aadhaar_number in registered_aadhaars:
        raise HTTPException(status_code=400, detail=f"Aadhaar Already Linked: This identity is already registered with {registered_aadhaars[aadhaar_number]}. Enrollment Denied.")

    if db_fire:
        # Check if any user already has this Aadhaar registered (Full or Masked)
        existing = db_fire.collection("users").where("aadhaar", "==", aadhaar_number).limit(1).get()
        if not existing:
            # Fallback check for masked legacy Aadhaar
            masked = "*" * 8 + aadhaar_number[-4:]
            existing = db_fire.collection("users").where("aadhaar", "==", masked).limit(1).get()

        if existing:
            raise HTTPException(status_code=400, detail="Aadhaar Registry Conflict: This identity is already registered with another account.")
    
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
             print("!!! SECURITY REJECTION: Mobile not found in OCR text.", file=sys.stderr, flush=True)
             raise HTTPException(
                 status_code=400, 
                 detail="Aadhaar Rejected: Could not find a linked mobile number on the card. Please provide a high-quality scan of a proper Aadhaar card including your phone number."
             )

        # 6. GENERATE BACKEND OTP (Failover)
        otp = str(random.randint(100000, 999999))
        otp_store[aadhaar_number] = otp
        
        # Delivery 1: Physical SMS (Twilio) - Occurs immediately as a primary/secondary delivery
        sms_success = send_real_sms(
            to_mobile=mobile_no,
            body=f"Your SecureVote Identity Verification Code is: {otp}. Valid for 10 minutes."
        )

        sys.stderr.write("\n" + "█"*60 + "\n")
        sys.stderr.write(f"  CRITICAL: VOTER OTP GENERATED (BACKEND GATEWAY)\n")
        sys.stderr.write(f"  PHONE: +91 {mobile_no}\n")
        sys.stderr.write(f"  OTP:   {otp}\n")
        if not sms_success:
            sys.stderr.write(f"  [GATEWAY] Twilio SMS Failed or Not Configured.\n")
        else:
            sys.stderr.write(f"  [GATEWAY] Backend SMS Dispatched via Twilio.\n")
        sys.stderr.write("█"*60 + "\n\n")
        sys.stderr.flush()

        print(f"DEBUG: Preparing Final Response for {aadhaar_number}", file=sys.stderr, flush=True)
        response_data = {
            "status": "verified",
            "extractedAadhaar": extracted_no,
            "linkedMobile": f"xxxxxx{mobile_no[-4:]}",
            "fullMobile": mobile_no,
            "backendOtpSent": sms_success,
            "message": "Identity Linked. Verification initiated."
        }
        print(f"DEBUG: Returning JSON: {response_data}", file=sys.stderr, flush=True)
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        print(f"!!! CRITICAL EXCEPTION TYPE: {type(e).__name__} !!!", file=sys.stderr, flush=True)
        print(f"CRITICAL OCR FAILURE:\n{traceback_str}", file=sys.stderr, flush=True)
        raise HTTPException(status_code=500, detail=f"AI Engine Error [{type(e).__name__}]: {str(e)}")

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
            print(f"!!! FIREBASE VERIFICATION FAILED: {str(e)}", file=sys.stderr, flush=True)
            # Re-raise with a more descriptive internal detail if needed
            raise HTTPException(status_code=401, detail=f"Firebase Auto-Auth Failed: {str(e)}")
    
    # Handle Role-Specific Mock Tokens
    if token == "admin-token":
        return {"uid": "mock-admin-uid-999", "email": "admin@test.com", "role": "admin"}
    if token == "voter-token":
        return {"uid": "mock-voter-uid-888", "email": "voter@test.com", "role": "voter"}
        
    
    return {"uid": "mock-firebase-uid-123", "email": "mock@example.com", "role": "admin"}

@app.post("/api/admin/create-user")
async def admin_create_user(req: AdminCreateUserRequest, current_user: dict = Depends(verify_jwt)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized: Only admins can provision new accounts.")
    
    if not db_fire:
        raise HTTPException(status_code=500, detail="Firebase Admin SDK not initialized.")

    try:
        # 1. Aadhaar Uniqueness Check
        existing_doc = db_fire.collection("users").where("aadhaar", "==", req.aadhaar).limit(1).get()
        if existing_doc:
             raise HTTPException(status_code=400, detail="Identity Conflict: Aadhaar already registered.")

        # 2. Create in Firebase Auth
        new_user = auth.create_user(
            email=req.email,
            password=req.password,
            display_name=f"{req.role.upper()} Internal"
        )

        # 3. Store Profile in Firestore
        db_fire.collection("users").document(new_user.uid).set({
            "email": req.email,
            "role": req.role,
            "aadhaar": req.aadhaar,
            "isVerified": True,
            "createdAt": firestore.SERVER_TIMESTAMP
        })

        return {"status": "success", "message": f"Successfully provisioned {req.role} account.", "uid": new_user.uid}
    except Exception as e:
        print(f"Admin Creation Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/voters/register")
def register_voter(voter: VoterRegistration, user: dict = Depends(verify_jwt)):
    if not db_fire:
        print(f"Mock: Saving Aadhaar {voter.aadhaar} for email {voter.email} to session registry.")
        registered_aadhaars[voter.aadhaar] = voter.email
        return {"status": "mock_success", "uid": user["uid"]}
        
    try:
        # CRITICAL: Final check for Aadhaar Uniqueness before committing to DB
        # Check both the session-memory and the Firestore
        if voter.aadhaar in registered_aadhaars and registered_aadhaars[voter.aadhaar] != voter.email:
             raise HTTPException(status_code=400, detail="Aadhaar Collision: This identity is already active in a separate session.")

        query = db_fire.collection("users").where("aadhaar", "==", voter.aadhaar).limit(1).get()
        if any(doc.id != user["uid"] for doc in query):
            raise HTTPException(status_code=400, detail="Aadhaar Collision: This identity is already linked to another email in Firestore.")

        user_ref = db_fire.collection("users").document(user["uid"])
        user_ref.set({
            "email": voter.email,
            "role": voter.role,
            "aadhaar": voter.aadhaar, # Full Aadhaar stored for uniqueness
            "voterId": voter.voter_id,
            "mobile": voter.mobile,
            "walletAddress": voter.wallet_address,
            "isVerified": True,
            "verifiedAt": firestore.SERVER_TIMESTAMP,
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        # Register in session cache as well
        registered_aadhaars[voter.aadhaar] = voter.email
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
                # Ensure we check the LATEST electionId from the contract
                curr_election_id = blockchain.contract.functions.electionId().call()
                blockchain_voted = blockchain.contract.functions.hasVotedInElection(curr_election_id, voter_hash).call()
                print(f">>> [PROFILE] BLOCKCHAIN AUDIT (EID:{curr_election_id}): Voted={blockchain_voted}", file=sys.stderr, flush=True)
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
        voting_ended = blockchain.get_voting_status()
        return {"status": "success", "results": results, "votingEnded": voting_ended}
    except Exception as e:
        print(f"Contract Read Error: {e}")
        return {"status": "error", "message": f"Blockchain Sync Failed: {str(e)}", "results": [], "votingEnded": False}

@app.get("/api/voting-status")
def get_voting_status():
    return {"status": "success", "votingEnded": blockchain.get_voting_status()}

@app.post("/api/end-voting")
def end_voting(user: dict = Depends(verify_jwt)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Authority Denied: Only Admin can end the session.")
    try:
        tx_hash = blockchain.end_voting()
        return {"status": "success", "txHash": tx_hash, "message": "Voting system has been immutably closed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/start-new-election")
def start_new_election(name: str = Form(...), user: dict = Depends(verify_jwt)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can reset the election.")
    try:
        tx_hash = blockchain.start_new_election(name)
        return {"status": "success", "txHash": tx_hash, "message": f"New election '{name}' started on the ledger."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/candidates/add")
def add_candidate_onchain(name: str = Form(...), symbol: str = Form(...), user: dict = Depends(verify_jwt)):
    """Backend-signed transaction to add a candidate (Admin only)."""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Authority Denied: Only Admin can add to ledger.")
    
    try:
        tx_hash = blockchain.add_candidate(name, symbol)
        if not tx_hash:
            raise HTTPException(status_code=500, detail="Blockchain Service Initializing. Try again.")
        return {"status": "success", "txHash": tx_hash, "message": f"Candidate {name} ({symbol}) secured on blockchain."}
    except Exception as e:
        print(f"Blockchain Write Error: {e}")
        raise HTTPException(status_code=500, detail=f"Transaction Failed: {str(e)}")

@app.post("/api/vote")
async def cast_vote_onchain(candidate_id: int = Form(...), user: dict = Depends(verify_jwt)):
    """Backend-signed transaction to cast a vote (Voter verification required)."""
    if not user["uid"]:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        # 1. Check if voting is still active
        if blockchain.get_voting_status():
            raise HTTPException(status_code=403, detail="Voting period has expired. No more votes can be cast.")

        # Pass unique User ID to ensure 1-person-1-vote on the immutable ledger
        tx_hash = blockchain.cast_vote(candidate_id, user["uid"])
        if not tx_hash:
            raise HTTPException(status_code=500, detail="Blockchain sync failed.")
            
        # 2. Trigger Email Confirmation (Non-blocking)
        try:
            results = blockchain.get_results()
            candidate_name = "Selected Candidate"
            for c in results:
                if c["id"] == candidate_id:
                    candidate_name = c["name"]
                    break
            
            voter_email = user.get("email")
            if voter_email and voter_email != "mock@example.com":
                send_real_email(
                    to_email=voter_email,
                    subject="SecureVote: Vote Confirmed",
                    body=f"Dear Voter,\n\nYour vote for '{candidate_name}' has been successfully cast and recorded on the Ethereum Blockchain.\n\nTx Hash: {tx_hash}\n\nThis vote is now immutable and cannot be altered. Thank you for your participation.\n\nSecureVote System"
                )
        except Exception as email_err:
            print(f"Non-critical: Email notification failed: {email_err}")

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
