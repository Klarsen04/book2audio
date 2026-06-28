import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree

import fitz
from bs4 import BeautifulSoup
from docx import Document


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


def _epub_spine_hrefs(zf: zipfile.ZipFile) -> tuple[str, list[str]]:
    """Parse the OPF to get the book title and spine-ordered content hrefs."""
    container = ElementTree.fromstring(zf.read("META-INF/container.xml"))
    ns = {"c": "urn:oasis:names:tc:opendocument:xmlns:container"}
    rootfile_path = container.find(".//c:rootfile", ns).get("full-path")

    opf = ElementTree.fromstring(zf.read(rootfile_path))
    opf_ns = {"opf": "http://www.idpf.org/2007/opf", "dc": "http://purl.org/dc/elements/1.1/"}
    opf_dir = rootfile_path.rsplit("/", 1)[0] + "/" if "/" in rootfile_path else ""

    title_el = opf.find(".//dc:title", opf_ns)
    title = title_el.text.strip() if title_el is not None and title_el.text else "Untitled"

    manifest = {}
    for item in opf.findall(".//opf:manifest/opf:item", opf_ns):
        manifest[item.get("id")] = opf_dir + item.get("href")

    spine_hrefs = []
    for itemref in opf.findall(".//opf:spine/opf:itemref", opf_ns):
        idref = itemref.get("idref")
        if idref in manifest:
            spine_hrefs.append(manifest[idref])

    return title, spine_hrefs


def extract_from_epub(file_bytes: bytes) -> BookContent:
    zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    title, spine_hrefs = _epub_spine_hrefs(zf)

    chapters: list[Chapter] = []
    chapter_num = 1

    for href in spine_hrefs:
        try:
            content = zf.read(href)
        except KeyError:
            continue

        soup = BeautifulSoup(content, "html.parser")

        heading = soup.find(re.compile(r"^h[1-3]$"))
        chapter_title = heading.get_text(strip=True) if heading else f"Chapter {chapter_num}"

        paragraphs = soup.find_all("p")
        text = "\n".join(p.get_text(strip=True) for p in paragraphs)

        if text.strip():
            chapters.append(Chapter(title=chapter_title, text=text.strip()))
            chapter_num += 1

    zf.close()

    if not chapters:
        chapters = [Chapter(title="Full Text", text="No readable content found.")]

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
