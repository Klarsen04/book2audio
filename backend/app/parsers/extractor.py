import io
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

import fitz
from bs4 import BeautifulSoup
from docx import Document
from ebooklib import epub


@dataclass
class Chapter:
    title: str
    text: str


@dataclass
class BookContent:
    title: str
    chapters: list[Chapter]
    word_count: int


def extract_from_pdf(file_bytes: bytes) -> BookContent:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    title = doc.metadata.get("title", "") or "Untitled"

    chapters: list[Chapter] = []
    current_text = ""
    current_title = "Chapter 1"
    chapter_num = 1

    for page in doc:
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                text = "".join(span["text"] for span in line["spans"])
                font_size = max((span["size"] for span in line["spans"]), default=12)

                if font_size > 16 and len(text.strip()) < 100 and text.strip():
                    if current_text.strip():
                        chapters.append(Chapter(title=current_title, text=current_text.strip()))
                    chapter_num += 1
                    current_title = text.strip()
                    current_text = ""
                else:
                    current_text += text + " "

    if current_text.strip():
        chapters.append(Chapter(title=current_title, text=current_text.strip()))

    if not chapters:
        full_text = "\n".join(page.get_text() for page in doc)
        chapters = [Chapter(title="Full Text", text=full_text)]

    doc.close()
    word_count = sum(len(ch.text.split()) for ch in chapters)
    return BookContent(title=title, chapters=chapters, word_count=word_count)


def extract_from_epub(file_bytes: bytes) -> BookContent:
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    book = epub.read_epub(tmp_path)
    title = book.get_metadata("DC", "title")
    title = title[0][0] if title else "Untitled"

    chapters: list[Chapter] = []
    chapter_num = 1

    for item in book.get_items_of_type(9):  # ITEM_DOCUMENT
        soup = BeautifulSoup(item.get_content(), "html.parser")

        heading = soup.find(re.compile(r"^h[1-3]$"))
        chapter_title = heading.get_text(strip=True) if heading else f"Chapter {chapter_num}"

        paragraphs = soup.find_all("p")
        text = "\n".join(p.get_text(strip=True) for p in paragraphs)

        if text.strip():
            chapters.append(Chapter(title=chapter_title, text=text.strip()))
            chapter_num += 1

    if not chapters:
        chapters = [Chapter(title="Full Text", text="No readable content found.")]

    import os
    os.unlink(tmp_path)

    word_count = sum(len(ch.text.split()) for ch in chapters)
    return BookContent(title=title, chapters=chapters, word_count=word_count)


def extract_from_docx(file_bytes: bytes) -> BookContent:
    doc = Document(io.BytesIO(file_bytes))
    title = doc.core_properties.title or "Untitled"

    chapters: list[Chapter] = []
    current_text = ""
    current_title = "Chapter 1"
    chapter_num = 1

    for para in doc.paragraphs:
        if para.style.name.startswith("Heading"):
            if current_text.strip():
                chapters.append(Chapter(title=current_title, text=current_text.strip()))
            chapter_num += 1
            current_title = para.text.strip() or f"Chapter {chapter_num}"
            current_text = ""
        else:
            current_text += para.text + "\n"

    if current_text.strip():
        chapters.append(Chapter(title=current_title, text=current_text.strip()))

    if not chapters:
        full_text = "\n".join(p.text for p in doc.paragraphs)
        chapters = [Chapter(title="Full Text", text=full_text)]

    word_count = sum(len(ch.text.split()) for ch in chapters)
    return BookContent(title=title, chapters=chapters, word_count=word_count)


def extract_from_txt(file_bytes: bytes) -> BookContent:
    text = file_bytes.decode("utf-8", errors="replace")

    chapter_pattern = re.compile(
        r"^(chapter\s+\d+[^\n]*|part\s+\d+[^\n]*)", re.IGNORECASE | re.MULTILINE
    )
    splits = chapter_pattern.split(text)

    chapters: list[Chapter] = []
    if len(splits) > 1:
        if splits[0].strip():
            chapters.append(Chapter(title="Introduction", text=splits[0].strip()))
        for i in range(1, len(splits), 2):
            title = splits[i].strip()
            body = splits[i + 1].strip() if i + 1 < len(splits) else ""
            if body:
                chapters.append(Chapter(title=title, text=body))
    else:
        chapters = [Chapter(title="Full Text", text=text.strip())]

    word_count = sum(len(ch.text.split()) for ch in chapters)
    return BookContent(title="Untitled", chapters=chapters, word_count=word_count)


EXTRACTORS = {
    ".pdf": extract_from_pdf,
    ".epub": extract_from_epub,
    ".docx": extract_from_docx,
    ".txt": extract_from_txt,
}


def extract_text(filename: str, file_bytes: bytes) -> BookContent:
    ext = Path(filename).suffix.lower()
    extractor = EXTRACTORS.get(ext)
    if not extractor:
        raise ValueError(f"Unsupported file format: {ext}")
    return extractor(file_bytes)
