# FileForge ⚡

FileForge is a modern, lightweight, high-performance Python HTTP file server designed primarily for Android/Termux, but also compatible with Linux, macOS, and Windows.

## Features

- 🚀 **Fast & Lightweight**: Built with FastAPI & Uvicorn. Low RAM usage and minimal dependencies.
- 📱 **Mobile-First Responsive UI**: Sleek, modern interface supporting grid & list views, drag-and-drop upload, breadcrumbs, search, and system/light/dark themes.
- 🔒 **Security First**: Comprehensive path traversal prevention, symlink escape protection, safe path resolution, and secure file handling.
- 🔑 **Optional Auth & Secure Sharing**: Password protection, session management, and share links with optional passwords & expiration dates.
- 🎥 **Media Previews & HTTP Range Streaming**: Stream video, audio, and large files with range request support, inline code/text previews, PDF and image viewers.
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

## Running on Termux (Android)

1. Grant storage permission: `termux-setup-storage`
2. Install FileForge: `pip install fileforge-server`
3. Launch server: `fileforge /storage/emulated/0`
4. Access via browser on phone (`http://localhost:8080`) or LAN devices (`http://<phone-ip>:8080`).

## License

[MIT License](LICENSE)
