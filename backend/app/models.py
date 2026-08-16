"""Pydantic models for the NagRaksha API."""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field



class SosRequest(BaseModel):
    lat: float = 12.8003
    lng: float = 77.5954
    address: Optional[str] = None
    biteTime: Optional[str] = None
    bodyPart: Optional[str] = None
    snakeType: Optional[str] = None


class StockUpdate(BaseModel):
    status: str = "UNKNOWN"
    quantityBand: Optional[str] = None
    product: str = "Polyvalent ASV"
    verifiedBy: Optional[str] = "Hospital console"


class MythRequest(BaseModel):
    question: str = Field(..., min_length=1)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"] = "user"
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    incident_id: Optional[str] = None
    language: Optional[str] = None  # ISO 639-1 code from voice transcription or user selection


class SnakeIdRequest(BaseModel):
    image: Optional[str] = None
    text: Optional[str] = None


class SymptomRequest(BaseModel):
    code: Optional[str] = None
    label: Optional[str] = None
    severity: Optional[str] = None  # MILD | MODERATE | SEVERE
    value: Optional[str] = None
    author: Optional[str] = None


class VillageAuditRequest(BaseModel):
    asha_worker_id: str
    gram_panchayat: str
    district: str
    audit_date: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class HouseholdAuditRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    sleeps_on_floor: bool
    has_wall_gaps: bool
    adequate_lighting: bool
    wears_footwear_night: bool
    near_agri_field: bool
    prior_snakebite: bool
    knows_myths_facts: bool
    knows_nearest_hospital: bool
    notes: Optional[str] = None


class StakeholderRequest(BaseModel):
    name: str
    organization: str
    role: str
    support_type: str  # written | verbal | pilot_permission
    contact: Optional[str] = None
    district: Optional[str] = None


class TokenRequest(BaseModel):
    role: str  # victim | hospital_admin | system_admin
    secret: str


class ResponderRequest(BaseModel):
    name: str
    phone: str  # E.164 format: +919876543210
    role: str   # first_aider | snake_rescue | hospital_coordinator
    lat: float
    lng: float
    skills: Optional[str] = None


class PtosisReadingRequest(BaseModel):
    """Ptosis reading body — snake_case on the wire, camelCase in DB (pinned contract)."""

    right_aperture: float = Field(..., ge=0.0, le=1.0)
    left_aperture: float = Field(..., ge=0.0, le=1.0)
    avg_aperture: float = Field(..., ge=0.0, le=1.0)
    baseline_aperture: Optional[float] = None
    percent_change: Optional[float] = None
    ptosis_detected: bool = False
    severity: str = Field("none", pattern="^(none|mild|moderate|severe)$")
    asymmetric: bool = False
    minutes_since_bite: Optional[int] = Field(None, ge=0)


FacilityCapability = Literal[
    "ASV",
    "OXYGEN",
    "VENTILATION",
    "ICU",
    "BLOOD_BANK",
    "DIALYSIS",
    "EMERGENCY_CARE",
]
FacilityLevel = Literal["PHC", "CHC", "SDH", "DH", "TERTIARY"]


class HospitalCapabilityUpdate(BaseModel):
    facilityLevel: FacilityLevel = "PHC"
    capabilities: list[FacilityCapability] = Field(default_factory=lambda: ["ASV", "EMERGENCY_CARE"])
    ventilatorCount: int = Field(0, ge=0)
    icuBedsAvailable: int = Field(0, ge=0)


class ReferralCreateRequest(BaseModel):
    fromHospitalId: str
    toHospitalId: str
    missingCapabilities: list[FacilityCapability]
    clinicalReason: str
    urgency: Literal["CRITICAL_IMMEDIATE", "HIGH_PRIORITY", "ROUTINE"] = "HIGH_PRIORITY"


class ReferralAcceptRequest(BaseModel):
    acceptedBy: str = "Hospital Coordinator"
    notes: Optional[str] = None


class ReferralDeclineRequest(BaseModel):
    declinedBy: str = "Hospital Coordinator"
    reason: str = "No critical care beds available"


class ReferralResponse(BaseModel):
    id: str
    incidentId: str
    fromHospitalId: str
    toHospitalId: str
    status: str
    urgency: str
    missingCapabilities: list[str]
    clinicalReason: str
    acceptedAt: Optional[str] = None
    acceptedBy: Optional[str] = None
    declinedAt: Optional[str] = None
    declinedReason: Optional[str] = None
    transportStartedAt: Optional[str] = None
    arrivedAt: Optional[str] = None
    createdAt: str
    updatedAt: str

