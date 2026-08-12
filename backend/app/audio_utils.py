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
    except (subprocess.CalledProcessError, ValueError):
        return 0.0


def concat_mp3(paths: list[str | Path], out_path: str | Path) -> None:
    """
    Concatenate MP3 files into `out_path` without loading them into memory.

    Uses ffmpeg's concat demuxer with stream copy (fast, no re-encode). All
    inputs in a single conversion come from the same provider+voice, so their
    codec parameters match and `-c copy` is safe. If copy fails (mismatched
    parameters), fall back to a single re-encode pass, which ffmpeg still
    streams file-by-file.
    """
    paths = [Path(p) for p in paths]
    if not paths:
        raise ValueError("concat_mp3: no input files")

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
        try:
            subprocess.run(
                base_cmd + ["-c", "copy", str(out_path)],
                capture_output=True, check=True,
            )
        except subprocess.CalledProcessError:
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
