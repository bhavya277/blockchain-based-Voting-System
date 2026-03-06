from pydantic import BaseModel
from typing import Optional

class VoterRegistration(BaseModel):
    email: str
    role: str
    aadhaar: str
    voter_id: Optional[str] = "None"
    mobile: str
    wallet_address: Optional[str] = "not-connected"
