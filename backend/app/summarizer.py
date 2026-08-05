"""
Simple extractive text summarizer.
No external API needed — uses sentence scoring based on word frequency.

Two levels are supported and both ALWAYS reduce the text (down to a floor of a
few sentences) so the resulting audio is meaningfully shorter than the original.
The target ratios below are also mirrored in the frontend so the UI can preview
the expected reduction — keep them in sync with ConversionPanel.tsx.
"""

import re

# Fraction of sentences kept for each summary level. Kept in sync with the
# frontend so the UI can preview the expected reduction.
LONG_SUMMARY_RATIO = 0.35
SHORT_SUMMARY_RATIO = 0.12


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
    """Long summary: ~35% of sentences, preserving order."""
    return _summarize(text, LONG_SUMMARY_RATIO, floor=2)


def summarize_short(text: str) -> str:
    """Short summary: ~12% of sentences — a concise overview."""
    return _summarize(text, SHORT_SUMMARY_RATIO, floor=1)
