"""
MIDAS Utilities
Profiler and audio helpers
"""

import io
import wave
import time
import logging
import numpy as np
import torch

logger = logging.getLogger("MIDAS")

# =============================================================================
# LATENCY PROFILER
# =============================================================================
class Profiler:
    """Simple latency profiler for debugging."""
    
    def __init__(self):
        self.times = {}
        self._starts = {}
    
    def start(self, name: str) -> None:
        """Start timing a section."""
        self._starts[name] = time.perf_counter()
    
    def stop(self, name: str) -> float:
        """Stop timing and return milliseconds."""
        if name in self._starts:
            self.times[name] = (time.perf_counter() - self._starts[name]) * 1000
        return self.times.get(name, 0)
    
    def report(self) -> None:
        """Log a latency report."""
        logger.info("⏱️  LATENCY REPORT:")
        for name, ms in self.times.items():
            grade = "✅" if ms < 300 else "⚠️" if ms < 600 else "❌"
            logger.info(f"   {grade} {name}: {ms:.0f}ms")
    
    def reset(self) -> None:
        """Reset all timers."""
        self.times.clear()
        self._starts.clear()

# Global profiler instance
profiler = Profiler()

# =============================================================================
# AUDIO UTILITIES
# =============================================================================
def audio_to_wav_bytes(audio_tensor: torch.Tensor, sample_rate: int = 24000) -> bytes:
    """Convert audio tensor to WAV bytes without file I/O."""
    audio_np = audio_tensor.cpu().numpy()
    audio_int16 = (audio_np * 32767).astype(np.int16)
    
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_int16.tobytes())
    return buffer.getvalue()
