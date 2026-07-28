"""
Simple extractive text summarizer.
No external API needed — uses sentence scoring based on word frequency.
"""

import re
from dataclasses import dataclass


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


def summarize_long(text: str) -> str:
    """Long summary: ~30% of sentences, preserving order."""
    sentences = _split_sentences(text)
    if len(sentences) <= 5:
        return text

    scored = _score_sentences(sentences)
    target = max(3, int(len(sentences) * 0.3))
    top = sorted(scored, key=lambda x: x[0], reverse=True)[:target]
    # Restore original order
    selected = sorted(top, key=lambda x: x[1])
    return " ".join(s[2] for s in selected)


def summarize_short(text: str) -> str:
    """Short summary: first + last sentence of each paragraph block, ~10% of content."""
    sentences = _split_sentences(text)
    if len(sentences) <= 3:
        return text

    scored = _score_sentences(sentences)
    target = max(2, int(len(sentences) * 0.1))
    top = sorted(scored, key=lambda x: x[0], reverse=True)[:target]
    selected = sorted(top, key=lambda x: x[1])
    return " ".join(s[2] for s in selected)
