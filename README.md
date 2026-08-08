# FileForge ⚡

FileForge is a modern, lightweight, high-performance Python HTTP file server designed primarily for Android/Termux, but also compatible with Linux, macOS, and Windows.

## Features

- 🚀 **Fast & Lightweight**: Built with FastAPI & Uvicorn. Low RAM usage and minimal dependencies.
- 📱 **Mobile-First Responsive UI**: Sleek, modern interface supporting grid & list views, drag-and-drop upload, breadcrumbs, search, and system/light/dark themes.
- 🎬 **Watch Media Mode**: Built-in, local-first video watching mode supporting HTTP 206 Partial Content range streaming, playback progress tracking, local `.srt`/`.vtt` subtitles, smart folder categorization, video cards, keyboard controls, and optional FFmpeg thumbnails.
- 🔒 **Security First**: Comprehensive path traversal prevention, symlink escape protection, safe path resolution, and secure file handling.
- 🔑 **Optional Auth & Secure Sharing**: Password protection, session management, and share links with optional passwords & expiration dates.
- 📦 **ZIP & Multi-Select**: Multi-file select, folder archiving, batch copy/move/delete operations.
- 💾 **Storage Abstraction**: Configurable storage root directories for any custom directory, Termux storage, or desktop folders.

## Quick Start

### Installation

```bash
pip install fileforge-server
```

### Running FileForge

Serve current directory:
```bash
fileforge
```

Serve Termux storage:
```bash
fileforge /storage/emulated/0
```

Custom host, port, and authentication:
```bash
fileforge ~/Downloads --host 0.0.0.0 --port 8080 --auth-password secret
```

You can also run FileForge as a module:
```bash
python -m fileforge
```

## CLI Reference

```text
usage: fileforge [-h] [--host HOST] [--port PORT] [--auth-password AUTH_PASSWORD] [-v] [root_path]

FileForge: A modern, lightweight Python HTTP file server.

positional arguments:
  root_path             Root storage directory to serve (default: current directory)

options:
  -h, --help            show this help message and exit
  --host HOST           Host interface to bind (default: 0.0.0.0)
  --port PORT           Port number to listen on (default: 8080)
  --auth-password AUTH_PASSWORD
                        Optional admin password to protect access
  -v, --version         show program's version number and exit
```

## 🎬 Watch Media Mode

FileForge includes a clean, fast, local-first video watching mode accessible via the top-level **Watch** tab.

### Features
- 🚀 **Supported Video Formats**: `.mp4`, `.webm`, `.m4v`, `.mov`, `.avi`, `.mkv`.
- ⚡ **HTTP 206 Partial Content Streaming**: Fast seeking through multi-gigabyte video files without loading entire files into memory.
- ⏯️ **Continue Watching**: Playback progress is saved automatically so you can resume videos right where you left off.
- 💬 **Local Subtitles**: Automatically discovers neighboring `.srt` and `.vtt` subtitle files (e.g. `Movie.en.srt`, `Movie.hi.vtt`) and converts SRT to WebVTT on the fly.
- 🖼️ **Cached Thumbnails**: Optional background thumbnail generation using `ffmpeg`. If FFmpeg is not installed, Watch falls back gracefully to clean line SVG icons.
- 📱 **Multi-Device & LAN Streaming**: Serve videos from your Android phone running Termux and stream directly on your TV, laptop, or tablet on the same Wi-Fi network.

### Multi-Device Example (Termux to Laptop / TV)

1. **Launch FileForge on Android phone**:
   ```bash
   fileforge /storage/emulated/0/Movies --host 0.0.0.0 --port 8080
   ```
2. **Open browser on any device on the same local network**:
   ```text
   http://192.168.1.50:8080/watch
   ```
3. Click any video card to stream with full seek, playback speed control (`0.5x` to `2x`), picture-in-picture, and subtitle support.

## License

[MIT License](LICENSE)
