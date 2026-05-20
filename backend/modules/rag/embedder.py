def chunk_text(text, size=500, overlap=50):
    """Splits large text (like a resume) into smaller chunks for better RAG."""
    chunks = []
    for i in range(0, len(text), size - overlap):
        chunks.append(text[i : i + size])
    return chunks