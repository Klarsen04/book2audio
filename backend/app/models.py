from pydantic import BaseModel, EmailStr
from typing import Optional


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    avatar_url: Optional[str]


class DocumentResponse(BaseModel):
    id: str
    filename: str
    title: str
    format: str
    chapters: list[dict]
    total_word_count: int
    status: str
    voice: Optional[str]
    audio_duration: Optional[float]
    created_at: str
    converted_at: Optional[str]


class PlaybackPositionRequest(BaseModel):
    position: float
