"""Pydantic models for the NagRaksha API."""
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional


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
