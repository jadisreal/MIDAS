"""
MIDAS Model Loaders
STT, LLM, TTS initialization
"""

import logging
import torch
from faster_whisper import WhisperModel
from llama_cpp import Llama

from .config import LLM_MODEL_PATH, TTS_MODEL_PATH, WARMUP_AUDIO_PATH, KNOWLEDGE_DIR
from .rag import SimpleRAG

logger = logging.getLogger("MIDAS")

# =============================================================================
# GLOBAL MODEL INSTANCES (loaded on import)
# =============================================================================
rag: SimpleRAG = None
ear: WhisperModel = None
llm: Llama = None
tts = None

def load_all_models() -> None:
    """Load all AI models. Call this once at startup."""
    global rag, ear, llm, tts
    
    logger.info("🚀 MIDAS ENGINE: Loading models...")
    
    # 1. RAG
    logger.info("📚 Loading RAG knowledge base...")
    rag = SimpleRAG(KNOWLEDGE_DIR)
    
    # 2. STT (Whisper)
    logger.info("👂 Loading Whisper base (int8)...")
    ear = WhisperModel("base", device="cuda", compute_type="int8", local_files_only=True)
    
    # 3. LLM
    logger.info("🧠 Loading LLM...")
    llm = Llama(
        model_path=LLM_MODEL_PATH,
        n_gpu_layers=-1,
        n_ctx=4096,
        n_batch=512,
        verbose=False
    )
    
    # 4. TTS (Silero)
    logger.info("🗣️ Loading Silero TTS...")
    tts = torch.package.PackageImporter(TTS_MODEL_PATH).load_pickle('tts_models', 'model')
    tts.to('cuda')
    
    # 5. Warmup
    logger.info("🔥 Warming up models...")
    _warmup()
    
    logger.info("=" * 60)
    logger.info("✅ MIDAS READY - All models warmed up")
    logger.info("=" * 60)

def _warmup() -> None:
    """Warm up models for faster first response."""
    global ear, llm, tts
    
    # STT warmup
    _segments, _ = ear.transcribe(WARMUP_AUDIO_PATH, beam_size=1, vad_filter=True)
    list(_segments)
    
    # LLM warmup
    _ = llm("<|im_start|>user\nHi<|im_end|>\n<|im_start|>assistant\n", max_tokens=5)
    
    # TTS warmup
    for _ in range(3):
        _ = tts.apply_tts(text="Hello.", speaker='en_0', sample_rate=24000)
    
    torch.cuda.synchronize()

def get_models():
    """Get all model instances."""
    return rag, ear, llm, tts
