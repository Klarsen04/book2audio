"""
Low-memory MP3 helpers.

The conversion pipeline used to build the whole audiobook as a single in-memory
`pydub.AudioSegment` (decoded PCM), which is ~10x the size of the compressed MP3
and blew past small hosts' RAM (e.g. Render free tier ~512 MB) on large books.

These helpers keep audio on disk and let ffmpeg stream it, so peak memory stays
bounded to a single chunk regardless of book length.
"""

import os
import subprocess
import tempfile
from pathlib import Path


def mp3_duration(path: str | Path) -> float:
    """Duration of an MP3 in seconds via ffprobe (no decode into memory)."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True, text=True, check=True,
        )
        return float(out.stdout.strip())
    except (subprocess.CalledProcessError, ValueError, OSError) as e:
        # OSError covers ffprobe missing entirely (FileNotFoundError). A 0.0
        # duration flattens every chapter start_time, so at least say why.
        print(f"[audio] ffprobe duration failed for {path}: {e}")
        return 0.0


def _stream_params(path: str | Path):
    """(codec, sample_rate, channels) of the first audio stream, or None if the
    probe fails — used to decide whether stream-copy concat is safe."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error", "-select_streams", "a:0",
                "-show_entries", "stream=codec_name,sample_rate,channels",
                "-of", "csv=p=0",
                str(path),
            ],
            capture_output=True, text=True, check=True,
        )
        vals = tuple(out.stdout.strip().split(","))
        return vals if vals and vals[0] else None
    except (subprocess.CalledProcessError, OSError):
        return None


def concat_mp3(paths: list[str | Path], out_path: str | Path) -> None:
    """
    Concatenate MP3 files into `out_path` without loading them into memory.

    Uses ffmpeg's concat demuxer with stream copy (fast, no re-encode). All
    inputs in a single conversion come from the same provider+voice, so their
    codec parameters match and `-c copy` is safe. If copy fails (mismatched
    parameters), fall back to a single re-encode pass, which ffmpeg still
    streams file-by-file.
    """
    # Drop missing or 0-byte inputs — a single empty/corrupt file makes ffmpeg's
    # concat (and even the re-encode fallback) fail for the whole batch.
    paths = [Path(p) for p in paths if Path(p).exists() and Path(p).stat().st_size > 0]
    if not paths:
        raise ValueError("concat_mp3: no non-empty input files")

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if len(paths) == 1:
        # Nothing to join — copy the single file straight through.
        with open(paths[0], "rb") as src, open(out_path, "wb") as dst:
            while chunk := src.read(1 << 20):
                dst.write(chunk)
        return

    # Write the concat list file (ffmpeg concat demuxer format).
    list_fd, list_path = tempfile.mkstemp(suffix=".txt")
    try:
        with os.fdopen(list_fd, "w") as lf:
            for p in paths:
                # Escape single quotes per the concat demuxer's quoting rules.
                escaped = str(p.resolve()).replace("'", "'\\''")
                lf.write(f"file '{escaped}'\n")

        base_cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path]

        # Stream copy is only safe when every input shares codec/sample-rate/
        # channels. Mixed inputs (e.g. some chunks fell back from edge-tts to
        # gTTS mid-book) usually concat "successfully" with -c copy but produce
        # broken timestamps/duration — so probe first and force the re-encode
        # path on any mismatch instead of relying on ffmpeg to fail.
        params = {_stream_params(p) for p in paths}
        homogeneous = len(params) == 1 and None not in params

        if homogeneous:
            try:
                subprocess.run(
                    base_cmd + ["-c", "copy", str(out_path)],
                    capture_output=True, check=True,
                )
                return
            except subprocess.CalledProcessError:
                pass
        subprocess.run(
            base_cmd + ["-c:a", "libmp3lame", "-b:a", "128k", str(out_path)],
            capture_output=True, check=True,
        )
    finally:
        try:
            os.unlink(list_path)
        except OSError:
            # Temp list file already gone; nothing to clean up.
            pass
