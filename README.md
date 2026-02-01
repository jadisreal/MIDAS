# 🎙️ MIDAS

> **M**y **I**ntelligent **D**igital **A**ssistant **S**ystem — A fully offline, privacy-first voice assistant

[![License](https://img.shields.io/badge/license-MIT-gold.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://python.org)
[![CUDA](https://img.shields.io/badge/CUDA-11.8%2B-green.svg)](https://developer.nvidia.com/cuda-toolkit)

---

## ✨ What is MIDAS?

MIDAS is a **100% offline voice assistant** that runs entirely on your local machine. No cloud APIs, no data collection, no subscriptions — just you and your AI.

### Key Features

- 🔒 **Completely Offline** — All processing happens locally
- 🎤 **Voice Input** — Whisper-powered speech recognition
- 🔊 **Voice Output** — Natural text-to-speech with Silero
- 🧠 **Conversational AI** — Powered by Hermes 3 LLM (3B parameters)
- 💾 **Memory** — Remembers conversation context
- 📚 **RAG Support** — Add your own knowledge documents
- ⚡ **GPU Accelerated** — Fast inference with CUDA

---

## 🖥️ Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | Windows 10, Linux | Windows 11, Ubuntu 22.04 |
| **GPU** | NVIDIA 4GB VRAM | NVIDIA 6GB+ VRAM |
| **RAM** | 8 GB | 16 GB |
| **Python** | 3.10 | 3.11 |
| **CUDA** | 11.8 | 12.1+ |

> ⚠️ **AMD/Intel GPUs**: Currently not supported. CPU-only mode is possible but slow.

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/jadisreal/MIDAS.git
cd MIDAS
```

### 2. Create Virtual Environment

```bash
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# Windows (CMD)
.venv\Scripts\activate.bat

# Linux/macOS
source .venv/bin/activate
```

### 3. Install PyTorch with CUDA

```bash
# CUDA 12.1 (RTX 30/40 series, recommended)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# CUDA 11.8 (older GPUs)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 4. Install llama-cpp-python with CUDA

```powershell
# Windows (PowerShell)
$env:CMAKE_ARGS="-DGGML_CUDA=on"
pip install llama-cpp-python --force-reinstall --no-cache-dir
```

```bash
# Linux/macOS
CMAKE_ARGS="-DGGML_CUDA=on" pip install llama-cpp-python --force-reinstall --no-cache-dir
```

### 5. Install Dependencies

```bash
pip install -r requirements.txt
```

### 6. Download AI Models

```bash
python download_models.py
```

This downloads:
- **Hermes 3 LLM** (~1.9 GB) — Language model
- **Silero TTS** (~55 MB) — Text-to-speech

### 7. Run MIDAS

```bash
python server.py
```

Open **http://localhost:8000** in your browser.

---

## 📁 Project Structure

```
MIDAS/
├── server.py              # FastAPI server entry point
├── download_models.py     # Model downloader for first-time setup
├── requirements.txt       # Python dependencies
├── index.html             # Web interface
├── styles.css             # UI styling (Brutalist Gold theme)
│
├── src/
│   ├── config.py          # Configuration & settings
│   ├── models.py          # Model loading (LLM, Whisper, TTS)
│   ├── routes.py          # API endpoints
│   ├── rag.py             # RAG knowledge base
│   └── utils.py           # Utility functions
│
├── models/                # LLM model files (downloaded)
│   └── *.gguf
│
├── knowledge/             # RAG documents (add your .txt files here)
│   └── *.txt
│
├── data/                  # User data
│   └── settings.json      # Persisted settings
│
└── model.pt               # Silero TTS model (downloaded)
```

---

## ⚙️ Configuration

Settings can be changed via the web UI or by editing `data/settings.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `contextWindow` | 4096 | LLM context size in tokens |
| `maxTokens` | 256 | Maximum response length |
| `temperature` | 0.7 | Creativity (0.0 = deterministic, 1.0 = creative) |
| `topP` | 0.9 | Nucleus sampling threshold |
| `voiceEnabled` | true | Enable/disable voice output |

---

## 📚 Adding Knowledge (RAG)

Drop `.txt` files into the `knowledge/` folder. MIDAS will use them to answer questions.

Example use cases:
- Personal notes and documentation
- Product manuals
- Study materials
- Custom instructions

---

## 🔧 Troubleshooting

### "CUDA not available" or slow inference
1. Verify NVIDIA drivers: `nvidia-smi`
2. Check CUDA: `nvcc --version`
3. Reinstall llama-cpp-python with CUDA flag (Step 4)

### Out of memory errors
- Close other GPU applications
- Use a smaller model quantization (Q3_K_S)
- Reduce `contextWindow` in settings

### Model loading fails
1. Re-run `python download_models.py`
2. Verify files exist in `models/` folder
3. Check file sizes match expected values

### Microphone not working
- Allow microphone access in browser
- Check browser console for errors
- Try a different browser (Chrome recommended)

---

## 🎨 Theme

MIDAS features a **Brutalist Gold & Space** aesthetic — minimalist design with cosmic gold accents.

---

## 🛣️ Roadmap

- [ ] Multiple voice options
- [ ] Conversation export/import
- [ ] Plugin system
- [ ] Mobile-friendly UI
- [ ] Wake word detection

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) — LLM inference engine
- [faster-whisper](https://github.com/guillaumekln/faster-whisper) — Speech recognition
- [Silero Models](https://github.com/snakers4/silero-models) — Text-to-speech
- [Hermes 3](https://huggingface.co/NousResearch) — Language model by Nous Research
- [FastAPI](https://fastapi.tiangolo.com/) — Web framework

---

<p align="center">
  <b>Built with 🔥 for offline AI</b>
</p>

