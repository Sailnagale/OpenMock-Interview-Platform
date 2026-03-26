import chromadb
from chromadb.utils import embedding_functions

class VectorStore:
    def __init__(self):
        # Local storage in a folder named 'db_data'
        self.client = chromadb.PersistentClient(path="./db_data")
        self.embed_fn = embedding_functions.DefaultEmbeddingFunction()
        self.collection = self.client.get_or_create_collection(
            name="interview_data", 
            embedding_function=self.embed_fn
        )

    def add_document(self, doc_id, text, metadata):
        self.collection.add(
            documents=[text],
            metadatas=[metadata],
            ids=[doc_id]
        )

    def query(self, query_text, n_results=3):
        return self.collection.query(
            query_texts=[query_text],
            n_results=n_results
        )