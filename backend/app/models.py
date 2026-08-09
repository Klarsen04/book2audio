from pydantic import BaseModel
from typing import Optional


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
