"""
Storage-agnostic audio blob layer.

Default: local filesystem (works offline / today, no accounts needed).
Production persistence: set the S3-compatible env vars below and audio is
written to Backblaze B2 or Cloudflare R2 instead — both expose an S3 API, so we
reuse boto3 (already a dependency) with a custom endpoint. No new package.

Env to switch to cloud:
  AUDIO_BUCKET            bucket name
  AUDIO_S3_ENDPOINT       e.g. https://s3.us-west-004.backblazeb2.com (B2)
                          or   https://<accountid>.r2.cloudflarestorage.com (R2)
  AUDIO_S3_KEY_ID         access key id
  AUDIO_S3_SECRET_KEY     secret access key
  AUDIO_S3_REGION         optional, defaults to 'auto'

If AUDIO_BUCKET is unset, everything falls back to the local directory.
"""

import os
from pathlib import Path

# Local fallback dir (mirrors main.py's resolution).
if os.environ.get("AUDIO_OUTPUT_DIR"):
    _LOCAL_DIR = Path(os.environ["AUDIO_OUTPUT_DIR"])
elif os.environ.get("DOCKER"):
    _LOCAL_DIR = Path("/app/output")
else:
    _LOCAL_DIR = Path("./output")
_LOCAL_DIR.mkdir(parents=True, exist_ok=True)

_BUCKET = os.environ.get("AUDIO_BUCKET")
_USE_S3 = bool(_BUCKET)

_s3_client = None


def _s3():
    global _s3_client
    if _s3_client is None:
        import boto3

        _s3_client = boto3.client(
            "s3",
            endpoint_url=os.environ.get("AUDIO_S3_ENDPOINT"),
            aws_access_key_id=os.environ.get("AUDIO_S3_KEY_ID"),
            aws_secret_access_key=os.environ.get("AUDIO_S3_SECRET_KEY"),
            region_name=os.environ.get("AUDIO_S3_REGION", "auto"),
        )
    return _s3_client


def use_cloud() -> bool:
    return _USE_S3


def _key(doc_id: str) -> str:
    return f"audio/{doc_id}.mp3"


def local_path(doc_id: str) -> Path:
    """Local path where audio is written before upload (and served from locally)."""
    return _LOCAL_DIR / f"{doc_id}.mp3"


def save_audio(doc_id: str, source_path: str | Path) -> str:
    """
    Persist a freshly-synthesized MP3. Returns a storage reference to store in the
    DB's audio_path: the object key when on cloud, else the local file path.
    """
    source_path = Path(source_path)
    if _USE_S3:
        _s3().upload_file(str(source_path), _BUCKET, _key(doc_id),
                          ExtraArgs={"ContentType": "audio/mpeg"})
        return _key(doc_id)
    return str(source_path)


def exists(doc_id: str) -> bool:
    if _USE_S3:
        try:
            _s3().head_object(Bucket=_BUCKET, Key=_key(doc_id))
            return True
        except Exception:
            return False
    return local_path(doc_id).exists()


def open_stream(doc_id: str):
    """Return a binary file-like object for streaming/zipping the audio."""
    if _USE_S3:
        obj = _s3().get_object(Bucket=_BUCKET, Key=_key(doc_id))
        return obj["Body"]
    return open(local_path(doc_id), "rb")


def presigned_url(doc_id: str, expires_in: int = 86400, filename: str | None = None):
    """
    A time-limited direct GET URL for the audio object (cloud only), so clients
    stream straight from B2/R2 instead of proxying bytes through the backend
    (saves backend bandwidth/CPU). Returns None when using local storage or if
    the URL can't be generated. When `filename` is given, the object is served
    as an attachment with that name (for a download); otherwise inline (for
    playback — some mobile browsers refuse to play `attachment` media).
    """
    if not _USE_S3:
        return None
    params = {"Bucket": _BUCKET, "Key": _key(doc_id)}
    if filename:
        params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'
        params["ResponseContentType"] = "audio/mpeg"
    try:
        return _s3().generate_presigned_url("get_object", Params=params, ExpiresIn=expires_in)
    except Exception:
        return None


def read_bytes(doc_id: str) -> bytes:
    if _USE_S3:
        return _s3().get_object(Bucket=_BUCKET, Key=_key(doc_id))["Body"].read()
    return local_path(doc_id).read_bytes()


def delete_audio(doc_id: str) -> None:
    if _USE_S3:
        try:
            _s3().delete_object(Bucket=_BUCKET, Key=_key(doc_id))
        except Exception:
            pass
    else:
        p = local_path(doc_id)
        if p.exists():
            p.unlink()
