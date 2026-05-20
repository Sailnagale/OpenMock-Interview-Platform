# backend/intelligence/rag_engine.py
import chromadb
from sentence_transformers import SentenceTransformer

class RAGEngine:
    def __init__(self):
        # Local database storage
        self.chroma_client = chromadb.PersistentClient(path="./chroma_data")
        self.collection = self.chroma_client.get_or_create_collection(name="user_resume")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')

    def index_resume(self, text: str, user_id: str):
        """Convert resume text into searchable vectors."""
        embedding = self.model.encode(text).tolist()
        self.collection.add(
            embeddings=[embedding],
            documents=[text],
            ids=[user_id]
        )

    def get_resume_context(self, query: str):
        """Retrieve the most relevant parts of the resume for a question."""
        results = self.collection.query(
            query_texts=[query],
            n_results=2
        )
        return results['documents']