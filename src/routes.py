"""
MIDAS API Routes
FastAPI endpoints for the voice assistant
"""

import re
import logging
import torch
from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pathlib import Path

from .config import settings, history, SYSTEM_PROMPT, STATIC_DIR, BASE_DIR, KNOWLEDGE_DIR
from .models import get_models
from .utils import profiler, audio_to_wav_bytes

logger = logging.getLogger("MIDAS")
router = APIRouter()

# =============================================================================
# STATIC FILES
# =============================================================================
@router.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")

@router.get("/styles.css")
def styles():
    return FileResponse(STATIC_DIR / "styles.css", media_type="text/css")

@router.get("/app.js")
def app_js():
    return FileResponse(STATIC_DIR / "app.js", media_type="application/javascript")

# =============================================================================
# API ENDPOINTS
# =============================================================================
@router.get("/api/voices")
def list_voices():
    return {"voices": ["en_0", "en_1", "en_2", "en_3", "en_21", "en_24", "en_28", "en_30"]}

@router.post("/api/reload-knowledge")
def reload_knowledge():
    """Reload RAG knowledge base."""
    rag, _, _, _ = get_models()
    rag.reload()
    return {"status": "ok", "documents": len(rag.documents)}

# =============================================================================
# RAG KNOWLEDGE BASE API
# =============================================================================
@router.get("/api/knowledge")
def list_knowledge():
    """List all files in knowledge base."""
    files = []
    for ext in ['*.md', '*.txt']:
        for filepath in KNOWLEDGE_DIR.glob(ext):
            stat = filepath.stat()
            files.append({
                "name": filepath.name,
                "size": stat.st_size,
                "modified": int(stat.st_mtime * 1000)
            })
    return {"files": files, "path": str(KNOWLEDGE_DIR)}

@router.get("/api/knowledge/{filename}")
def get_knowledge_file(filename: str):
    """Get content of a specific knowledge file."""
    filepath = KNOWLEDGE_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        return {"error": "File not found"}, 404
    content = filepath.read_text(encoding='utf-8')
    return {"name": filename, "content": content}

@router.post("/api/knowledge")
async def create_knowledge_file(data: dict):
    """Create or update a knowledge file."""
    filename = data.get("name", "").strip()
    content = data.get("content", "")
    
    if not filename:
        return {"error": "Filename required"}, 400
    if not filename.endswith(('.md', '.txt')):
        filename += '.md'
    
    # Sanitize filename
    filename = re.sub(r'[^\w\-.]', '_', filename)
    filepath = KNOWLEDGE_DIR / filename
    
    filepath.write_text(content, encoding='utf-8')
    logger.info(f"📝 Knowledge file saved: {filename}")
    
    # Reload RAG
    rag, _, _, _ = get_models()
    rag.reload()
    
    return {"status": "ok", "name": filename, "documents": len(rag.documents)}

@router.delete("/api/knowledge/{filename}")
def delete_knowledge_file(filename: str):
    """Delete a knowledge file."""
    filepath = KNOWLEDGE_DIR / filename
    if filepath.exists() and filepath.is_file():
        filepath.unlink()
        logger.info(f"🗑️ Knowledge file deleted: {filename}")
        
        # Reload RAG
        rag, _, _, _ = get_models()
        rag.reload()
        
        return {"status": "ok", "documents": len(rag.documents)}
    return {"error": "File not found"}, 404

@router.get("/api/settings")
def get_settings():
    """Get current settings."""
    return settings.all()

@router.post("/api/settings")
async def update_settings(new_settings: dict):
    """Update and persist settings."""
    settings.update(new_settings)
    return {"status": "ok", "settings": settings.all()}

@router.get("/api/history")
def get_history():
    """Get conversation history."""
    return {"history": history.get_all()}

@router.delete("/api/history")
def clear_history():
    """Clear conversation history."""
    history.clear()
    return {"status": "ok"}

# =============================================================================
# TRANSCRIPTION
# =============================================================================
@router.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    rag, ear, llm, tts = get_models()
    
    profiler.reset()
    profiler.start("stt")
    
    temp_path = BASE_DIR / "temp_input.wav"
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)
    
    segments, info = ear.transcribe(
        str(temp_path),
        beam_size=settings.get("beamSize", 1),
        vad_filter=settings.get("vadFilter", True),
        vad_parameters=dict(min_silence_duration_ms=settings.get("vadThreshold", 300))
    )
    text = " ".join([s.text for s in segments]).strip()
    
    stt_ms = profiler.stop("stt")
    grade = "✅" if stt_ms < 200 else "⚠️" if stt_ms < 800 else "❌"
    logger.info(f"{grade} STT: '{text}' ({stt_ms:.0f}ms)")
    
    return {"text": text}

# =============================================================================
# CHAT WEBSOCKET
# =============================================================================
@router.websocket("/api/chat")
async def chat(websocket: WebSocket):
    await websocket.accept()
    rag, ear, llm, tts = get_models()
    
    try:
        data = await websocket.receive_json()
        user_text = data.get("text", "")
        voice = data.get("voice", settings.get("voice", "en_0"))
        
        # Get settings from request or use stored defaults
        req_settings = data.get("settings", {})
        temperature = req_settings.get("temperature", settings.get("temperature"))
        top_p = req_settings.get("topP", settings.get("topP"))
        top_k = req_settings.get("topK", settings.get("topK"))
        max_tokens = req_settings.get("maxTokens", settings.get("maxTokens"))
        repeat_penalty = req_settings.get("repeatPenalty", settings.get("repeatPenalty"))
        sample_rate = req_settings.get("sampleRate", settings.get("sampleRate"))
        
        if not user_text:
            await websocket.close()
            return
        
        # RAG: Retrieve relevant context
        context = rag.retrieve(user_text)
        
        if context:
            system_prompt = f"{SYSTEM_PROMPT}\n\nRelevant context:\n{context}"
            logger.info(f"📚 RAG: Found relevant context ({len(context)} chars)")
        else:
            system_prompt = SYSTEM_PROMPT
        
        # Build prompt with conversation history for memory
        prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
        
        # Include recent conversation turns (last 10 exchanges for better memory)
        recent_history = history.get_recent(10)
        for exchange in recent_history:
            if exchange.get('user'):
                prompt += f"<|im_start|>user\n{exchange['user']}<|im_end|>\n"
            if exchange.get('assistant'):
                prompt += f"<|im_start|>assistant\n{exchange['assistant']}<|im_end|>\n"
        
        # Add current user message
        prompt += f"<|im_start|>user\n{user_text}<|im_end|>\n<|im_start|>assistant\n"
        
        logger.info(f"💬 Prompt includes {len(recent_history)} history turns")
        
        profiler.start("llm_ttft")
        first_token = False
        first_tts = False
        
        stream = llm(
            prompt,
            max_tokens=max_tokens,
            stop=["<|im_end|>"],
            stream=True,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            repeat_penalty=repeat_penalty
        )
        
        buffer = ""
        full_response = ""
        
        for output in stream:
            token = output['choices'][0]['text']
            
            if not first_token:
                profiler.stop("llm_ttft")
                first_token = True
            
            buffer += token
            full_response += token
            
            # Flush on sentence end - aggressive chunking for lower latency
            if any(buffer.rstrip().endswith(p) for p in ['.', '!', '?', ',', ':', ';']) and len(buffer) > 5:
                clean = re.sub(r'\[.*?\]', '', buffer).strip()
                
                if clean:
                    await websocket.send_json({"type": "text_chunk", "content": clean + " "})
                    
                    if not first_tts:
                        profiler.start("tts_ttfs")
                    
                    # TTS synthesis - no blocking synchronize calls
                    audio = tts.apply_tts(text=clean, speaker=voice, sample_rate=sample_rate)
                    
                    if not first_tts:
                        profiler.stop("tts_ttfs")
                        first_tts = True
                    
                    wav_bytes = audio_to_wav_bytes(audio, sample_rate)
                    await websocket.send_bytes(wav_bytes)
                
                buffer = ""
        
        # Flush remaining
        if buffer.strip():
            clean = re.sub(r'\[.*?\]', '', buffer).strip()
            if clean:
                await websocket.send_json({"type": "text_chunk", "content": clean})
                audio = tts.apply_tts(text=clean, speaker=voice, sample_rate=sample_rate)
                wav_bytes = audio_to_wav_bytes(audio, sample_rate)
                await websocket.send_bytes(wav_bytes)
        
        await websocket.send_json({"type": "done"})
        
        # Save to history
        history.add(user_text, full_response.strip())
        
        profiler.report()
        logger.info(f"📝 Response: {full_response[:80]}...")
        
    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
