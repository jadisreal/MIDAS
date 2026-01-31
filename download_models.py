#!/usr/bin/env python3
"""
MIDAS Model Downloader
Downloads all required AI models for first-time setup.

Usage:
    python download_models.py

Models downloaded:
    - Hermes-3-Llama-3.2-3B (Q4_K_M quantization) - LLM
    - Silero TTS v3 - Text-to-Speech
    - Whisper base (downloaded automatically by faster-whisper on first run)
"""

import os
import sys
import urllib.request
import hashlib
from pathlib import Path

# =============================================================================
# CONFIGURATION
# =============================================================================

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"

MODELS = {
    "llm": {
        "name": "Hermes-3-Llama-3.2-3B.Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/Hermes-3-Llama-3.2-3B-GGUF/resolve/main/Hermes-3-Llama-3.2-3B-Q4_K_M.gguf",
        "size_mb": 1926,
        "dest": MODELS_DIR,
        "description": "Hermes 3 LLM (3B parameters, Q4_K_M quantization)"
    },
    "tts": {
        "name": "model.pt",
        "url": "https://models.silero.ai/models/tts/en/v3_en.pt",
        "size_mb": 55,
        "dest": BASE_DIR,
        "description": "Silero TTS v3 (English)"
    }
}

# =============================================================================
# DOWNLOAD FUNCTIONS
# =============================================================================

def get_file_size_mb(filepath: Path) -> float:
    """Get file size in MB."""
    if filepath.exists():
        return filepath.stat().st_size / (1024 * 1024)
    return 0

def download_with_progress(url: str, dest: Path, expected_size_mb: int) -> bool:
    """Download file with progress bar."""
    
    def progress_hook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100, (downloaded / total_size) * 100)
            downloaded_mb = downloaded / (1024 * 1024)
            total_mb = total_size / (1024 * 1024)
            bar_width = 40
            filled = int(bar_width * percent / 100)
            bar = "█" * filled + "░" * (bar_width - filled)
            sys.stdout.write(f"\r    [{bar}] {percent:5.1f}% ({downloaded_mb:.1f}/{total_mb:.1f} MB)")
            sys.stdout.flush()
    
    try:
        urllib.request.urlretrieve(url, dest, reporthook=progress_hook)
        print()  # New line after progress bar
        return True
    except Exception as e:
        print(f"\n    ❌ Error: {e}")
        return False

def verify_model(filepath: Path, expected_size_mb: int, tolerance: float = 0.1) -> bool:
    """Verify model file exists and is roughly the expected size."""
    if not filepath.exists():
        return False
    
    actual_size_mb = get_file_size_mb(filepath)
    min_size = expected_size_mb * (1 - tolerance)
    max_size = expected_size_mb * (1 + tolerance)
    
    return min_size <= actual_size_mb <= max_size

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 60)
    print("🚀 MIDAS Model Downloader")
    print("=" * 60)
    print()
    
    # Ensure models directory exists
    MODELS_DIR.mkdir(exist_ok=True)
    
    all_present = True
    downloads_needed = []
    
    # Check which models are missing
    print("📋 Checking models...")
    for key, model in MODELS.items():
        filepath = model["dest"] / model["name"]
        if verify_model(filepath, model["size_mb"]):
            print(f"    ✅ {model['description']}")
        else:
            print(f"    ❌ {model['description']} - MISSING")
            downloads_needed.append(key)
            all_present = False
    
    print()
    
    if all_present:
        print("✅ All models already downloaded!")
        print()
        print("Run MIDAS with:")
        print("    python server.py")
        return 0
    
    # Download missing models
    print(f"📥 Downloading {len(downloads_needed)} model(s)...")
    print()
    
    for key in downloads_needed:
        model = MODELS[key]
        filepath = model["dest"] / model["name"]
        
        print(f"⬇️  Downloading: {model['description']}")
        print(f"    URL: {model['url']}")
        print(f"    Size: ~{model['size_mb']} MB")
        print()
        
        success = download_with_progress(model["url"], filepath, model["size_mb"])
        
        if success and verify_model(filepath, model["size_mb"]):
            print(f"    ✅ Downloaded successfully!")
        else:
            print(f"    ❌ Download failed or file is corrupted!")
            print(f"    Please download manually from: {model['url']}")
            return 1
        
        print()
    
    print("=" * 60)
    print("✅ All models downloaded successfully!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("    1. Install dependencies: pip install -r requirements.txt")
    print("    2. Run MIDAS: python server.py")
    print("    3. Open http://localhost:8000 in your browser")
    print()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
