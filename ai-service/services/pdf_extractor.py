import asyncio
from PyPDF2 import PdfReader


def _extract_sync(file_path: str) -> str:
    lower = file_path.lower()

    # Check by extension or by magic bytes
    is_pdf = lower.endswith(".pdf") or (not lower.endswith(".docx") and not lower.endswith(".doc"))
    
    # Try PDF first if no clear extension
    if is_pdf:
        try:
            reader = PdfReader(file_path)
            return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        except Exception:
            pass

    if lower.endswith(".docx"):
        from docx import Document
        doc = Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs).strip()

    if lower.endswith(".doc"):
        # .doc (legacy binary) — best-effort via textract if available, else raise
        try:
            import textract
            return textract.process(file_path).decode("utf-8", errors="ignore").strip()
        except ImportError:
            raise ValueError("Legacy .doc files are not supported. Please upload PDF or DOCX.")

    raise ValueError(f"Unsupported file type: {file_path}")


async def extract_text(file_path: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _extract_sync, file_path)
