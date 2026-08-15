from pydantic import BaseModel


class PlaybackPositionRequest(BaseModel):
    position: float
