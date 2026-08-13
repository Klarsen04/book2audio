"""
Simple extractive text summarizer.
No external API needed — uses sentence scoring based on word frequency.

Two levels are supported and both ALWAYS reduce the text (down to a floor of a
few sentences) so the resulting audio is meaningfully shorter than the original.
The target ratios below are also mirrored in the frontend so the UI can preview
the expected reduction — keep them in sync with ConversionPanel.tsx.
"""

import os
import re
import logging

logger = logging.getLogger(__name__)

# Fraction of sentences kept for each summary level. Kept in sync with the
# frontend so the UI can preview the expected reduction.
LONG_SUMMARY_RATIO = 0.35
SHORT_SUMMARY_RATIO = 0.12

# Optional: use Google Gemini (free tier) for genuinely rewritten summaries.
# If no key is set, or Gemini errors / hits its rate limit, we transparently
# fall back to the extractive summarizer below — so summaries always work.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
_GEMINI_INPUT_CHARS = 40000  # cap the text we send (keeps us well within limits)


def _gemini_generate(prompt: str, max_output_tokens: int) -> str | None:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
    if not key:
        return None
    try:
        import httpx

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        resp = httpx.post(
            url,
            params={"key": key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": max_output_tokens, "temperature": 0.4},
            },
            timeout=45.0,
        )
        resp.raise_for_status()
        candidates = resp.json().get("candidates") or []
        if not candidates:
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        return text or None
    except Exception as e:
        # Rate-limited / network / bad model → caller falls back to extractive.
        logger.warning(f"Gemini summarize unavailable, falling back: {e}")
        return None


def _gemini_summarize(text: str, style: str) -> str | None:
    body = text.strip()
    if len(body) < 400:  # too short to improve on
        return None
    snippet = body[:_GEMINI_INPUT_CHARS]
    if style == "intro":
        prompt = (
            "Write a spoken introduction (max 150 words, plain narration, no markdown, "
            "no title, no bullet points) that previews what the following text is about, "
            "as if introducing an audiobook.\n\nTEXT:\n" + snippet
        )
        return _gemini_generate(prompt, 300)
    if style == "short":
        prompt = (
            "Summarize the following text as plain spoken narration (no markdown, no lists), "
            "to roughly 15% of its length, keeping the key points in reading order.\n\nTEXT:\n"
            + snippet
        )
        return _gemini_generate(prompt, 800)
    # long
    prompt = (
        "Summarize the following text as plain spoken narration (no markdown, no lists), "
        "to roughly one third of its length, preserving the main points and reading order.\n\nTEXT:\n"
        + snippet
    )
    return _gemini_generate(prompt, 1400)


def _split_sentences(text: str) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip() and len(s.strip()) > 10]


def _score_sentences(sentences: list[str]) -> list[tuple[float, int, str]]:
    word_freq: dict[str, int] = {}
    for sent in sentences:
        for word in re.findall(r'\b[a-z]{3,}\b', sent.lower()):
            word_freq[word] = word_freq.get(word, 0) + 1

    max_freq = max(word_freq.values()) if word_freq else 1
    for word in word_freq:
        word_freq[word] /= max_freq

    scored = []
    for i, sent in enumerate(sentences):
        words = re.findall(r'\b[a-z]{3,}\b', sent.lower())
        score = sum(word_freq.get(w, 0) for w in words) / max(len(words), 1)
        # Boost first and last sentences of text
        if i < 2 or i >= len(sentences) - 2:
            score *= 1.3
        scored.append((score, i, sent))

    return scored


def _summarize(text: str, ratio: float, floor: int) -> str:
    """Keep the top `ratio` of sentences (at least `floor`), preserving order.

    Always returns strictly fewer sentences than the input so long as there is
    more than one sentence to work with — so even short documents get trimmed.
    """
    sentences = _split_sentences(text)
    # Only a single sentence (or none) — nothing meaningful to trim.
    if len(sentences) <= 1:
        return text

    scored = _score_sentences(sentences)
    target = max(floor, int(round(len(sentences) * ratio)))
    # Guarantee the summary is shorter than the original.
    target = min(target, len(sentences) - 1)

    top = sorted(scored, key=lambda x: x[0], reverse=True)[:target]
    # Restore original reading order.
    selected = sorted(top, key=lambda x: x[1])
    return " ".join(s[2] for s in selected)


def summarize_long(text: str) -> str:
    """Long summary — Gemini (rewritten) if available, else extractive (~35%)."""
    return _gemini_summarize(text, "long") or _summarize(text, LONG_SUMMARY_RATIO, floor=2)


def summarize_short(text: str) -> str:
    """Short summary — Gemini (rewritten) if available, else extractive (~12%)."""
    return _gemini_summarize(text, "short") or _summarize(text, SHORT_SUMMARY_RATIO, floor=1)


# Spoken-intro ("preread") summary: a brief overview read at the very start of the
# audiobook before the main content. Capped so the intro stays ~1 minute.
INTRO_MAX_WORDS = 160


def summarize_intro(text: str) -> str:
    """
    A short spoken overview of what the audio is about, phrased as an intro.
    Unlike summarize_long/short this does NOT replace the audio — it's prepended
    to it. Returns the summary body (the caller adds any lead-in phrasing).
    """
    summary = _gemini_summarize(text, "intro") or _summarize(text, SHORT_SUMMARY_RATIO, floor=1)
    words = summary.split()
    if len(words) > INTRO_MAX_WORDS:
        summary = " ".join(words[:INTRO_MAX_WORDS]).rstrip(",;:") + "…"
    return summary
