"""
MIDAS RAG System
Simple keyword-based retrieval (CPU-only, no extra VRAM)
"""

import re
import logging
from pathlib import Path

logger = logging.getLogger("MIDAS")

class SimpleRAG:
    """Lightweight RAG using keyword matching - no embeddings needed."""
    
    def __init__(self, knowledge_dir: Path):
        self.knowledge_dir = knowledge_dir
        self.documents = []
        self.load_documents()
    
    def load_documents(self) -> None:
        """Load all markdown/text files from knowledge directory."""
        self.documents = []
        if not self.knowledge_dir.exists():
            self.knowledge_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"📁 Created knowledge directory: {self.knowledge_dir}")
            return
        
        for ext in ['*.md', '*.txt']:
            for filepath in self.knowledge_dir.glob(ext):
                try:
                    content = filepath.read_text(encoding='utf-8')
                    chunks = self._split_content(content, filepath.name)
                    self.documents.extend(chunks)
                except Exception as e:
                    logger.warning(f"Failed to load {filepath}: {e}")
        
        logger.info(f"📚 RAG loaded {len(self.documents)} chunks from {self.knowledge_dir}")
    
    def _split_content(self, content: str, source: str) -> list:
        """Split content into chunks by headers."""
        chunks = []
        sections = re.split(r'\n(?=#{1,3} )', content)
        for section in sections:
            section = section.strip()
            if len(section) > 20:
                chunks.append({
                    'content': section,
                    'source': source,
                    'keywords': set(re.findall(r'\b\w{3,}\b', section.lower()))
                })
        return chunks
    
    def retrieve(self, query: str, top_k: int = 2) -> str:
        """Retrieve relevant context using keyword matching."""
        if not self.documents:
            return ""
        
        query_keywords = set(re.findall(r'\b\w{3,}\b', query.lower()))
        
        scored = []
        for doc in self.documents:
            overlap = len(query_keywords & doc['keywords'])
            if overlap > 0:
                scored.append((overlap, doc))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        top_docs = scored[:top_k]
        
        if not top_docs:
            return ""
        
        context_parts = []
        for score, doc in top_docs:
            context_parts.append(f"[From {doc['source']}]\n{doc['content'][:500]}")
        
        return "\n\n".join(context_parts)
    
    def reload(self) -> None:
        """Reload documents from disk."""
        self.load_documents()
