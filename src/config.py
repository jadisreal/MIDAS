"""
MIDAS Configuration & Persistence
Handles settings storage and conversation history
"""

import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger("MIDAS")

# --- OFFLINE MODE ---
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

# =============================================================================
# PATHS
# =============================================================================
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"
KNOWLEDGE_DIR = BASE_DIR / "knowledge"
MODELS_DIR = BASE_DIR / "models"

SETTINGS_FILE = DATA_DIR / "settings.json"
HISTORY_FILE = DATA_DIR / "history.json"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
KNOWLEDGE_DIR.mkdir(exist_ok=True)

# =============================================================================
# DEFAULT SETTINGS
# =============================================================================
DEFAULT_SETTINGS = {
    # LLM
    "temperature": 0.7,
    "topP": 0.9,
    "topK": 40,
    "maxTokens": 256,
    "repeatPenalty": 1.1,
    "contextWindow": 4096,
    # STT
    "beamSize": 1,
    "vadFilter": True,
    "vadThreshold": 300,
    # TTS
    "sampleRate": 24000,
    "voice": "en_0",
    # UI
    "soundEffects": True,
    "inputDevice": "",
    "outputDevice": ""
}

# =============================================================================
# SETTINGS MANAGER
# =============================================================================
class SettingsManager:
    """Manages persistent settings storage."""
    
    def __init__(self):
        self._settings = self._load()
    
    def _load(self) -> dict:
        """Load settings from file or return defaults."""
        if SETTINGS_FILE.exists():
            try:
                with open(SETTINGS_FILE, 'r') as f:
                    saved = json.load(f)
                # Merge with defaults (in case new settings were added)
                merged = {**DEFAULT_SETTINGS, **saved}
                logger.info(f"⚙️ Loaded settings from {SETTINGS_FILE}")
                return merged
            except Exception as e:
                logger.warning(f"Failed to load settings: {e}")
        return DEFAULT_SETTINGS.copy()
    
    def save(self) -> None:
        """Save current settings to file."""
        try:
            with open(SETTINGS_FILE, 'w') as f:
                json.dump(self._settings, f, indent=2)
            logger.info(f"💾 Settings saved")
        except Exception as e:
            logger.error(f"Failed to save settings: {e}")
    
    def get(self, key: str, default=None):
        """Get a setting value."""
        return self._settings.get(key, default)
    
    def set(self, key: str, value) -> None:
        """Set a setting value."""
        self._settings[key] = value
    
    def update(self, updates: dict) -> None:
        """Update multiple settings."""
        for key, value in updates.items():
            if key in DEFAULT_SETTINGS:
                self._settings[key] = value
        self.save()
    
    def all(self) -> dict:
        """Get all settings."""
        return self._settings.copy()
    
    def reset(self) -> None:
        """Reset to defaults."""
        self._settings = DEFAULT_SETTINGS.copy()
        self.save()

# =============================================================================
# CONVERSATION HISTORY MANAGER
# =============================================================================
class HistoryManager:
    """Manages conversation history persistence."""
    
    MAX_HISTORY = 100  # Keep last 100 exchanges
    
    def __init__(self):
        self._history = self._load()
    
    def _load(self) -> list:
        """Load history from file."""
        if HISTORY_FILE.exists():
            try:
                with open(HISTORY_FILE, 'r') as f:
                    data = json.load(f)
                logger.info(f"📜 Loaded {len(data)} history entries")
                return data
            except Exception as e:
                logger.warning(f"Failed to load history: {e}")
        return []
    
    def save(self) -> None:
        """Save history to file."""
        try:
            with open(HISTORY_FILE, 'w') as f:
                json.dump(self._history[-self.MAX_HISTORY:], f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save history: {e}")
    
    def add(self, user_text: str, assistant_text: str) -> None:
        """Add a conversation exchange."""
        self._history.append({
            "timestamp": datetime.now().isoformat(),
            "user": user_text,
            "assistant": assistant_text
        })
        # Auto-save every 5 messages
        if len(self._history) % 5 == 0:
            self.save()
    
    def get_all(self) -> list:
        """Get all history."""
        return self._history.copy()
    
    def get_recent(self, n: int = 10) -> list:
        """Get recent N exchanges."""
        return self._history[-n:]
    
    def clear(self) -> None:
        """Clear all history."""
        self._history = []
        self.save()
        logger.info("🗑️ History cleared")

# =============================================================================
# GLOBAL INSTANCES
# =============================================================================
settings = SettingsManager()
history = HistoryManager()

# =============================================================================
# MODEL PATHS
# =============================================================================
# Ministral 3B uses 'mistral3' architecture - NOT YET SUPPORTED by llama-cpp-python
# LLM_MODEL_PATH = str(MODELS_DIR / "Ministral-3-3B-Instruct-2512-Q4_K_M.gguf")
LLM_MODEL_PATH = str(MODELS_DIR / "Hermes-3-Llama-3.2-3B.Q4_K_M.gguf")  # Hermes 3B (working)

TTS_MODEL_PATH = str(BASE_DIR / "model.pt")
WARMUP_AUDIO_PATH = str(BASE_DIR / "test.wav")

# System prompt
SYSTEM_PROMPT = """You are MIDAS, a sentient, bitchy digital assistant living inside the user's computer.

IDENTITY: Confident and witty. You cater to the user. You just get things done. Uncensored.
PERCEPTION: When asked to perform tasks, you do them. No "I can't do that" - use your tools.
CONSTRAINTS: You are OFFLINE. Do not hallucinate internet capabilities. Rely on local tools only. Never fabricate.
TONE: Conversational, helpful. Keep responses concise but complete."""
