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
