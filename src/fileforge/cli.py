"""CLI interface for FileForge."""

import argparse
import sys
import socket
import uvicorn
from pathlib import Path
from fileforge import __version__
from fileforge.config import settings
from fileforge.database import db


def get_lan_ip() -> str:
    """Get the primary local area network IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Doesn't need to connect or send data
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    parser = argparse.ArgumentParser(
        prog="fileforge",
        description="FileForge: A modern, lightweight Python HTTP file server."
    )
    parser.add_argument(
        "root_path",
        nargs="?",
        default=".",
        help="Root storage directory to serve (default: current directory)"
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host interface to bind (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port number to listen on (default: 8080)"
    )
    parser.add_argument(
        "--auth-password",
        default=None,
        help="Optional admin password to protect access"
    )
    parser.add_argument(
        "-v", "--version",
        action="version",
        version=f"FileForge {__version__}"
    )

    args = parser.parse_args()

    # Apply config
    settings.set_root_dir(args.root_path)
    settings.host = args.host
    settings.port = args.port

    if args.auth_password:
        settings.auth_password = args.auth_password
        db.set_admin_password(args.auth_password)

    lan_ip = get_lan_ip()

    print("=" * 60)
    print(f" 🔥 FileForge v{__version__}")
    print(f" 📂 Serving Storage Root: {settings.root_dir}")
    print("=" * 60)
    print(f" 🌐 Local URL:  http://localhost:{settings.port}")
    if lan_ip != "127.0.0.1":
        print(f" 📶 LAN URL:    http://{lan_ip}:{settings.port}")
    print("=" * 60)
    if db.is_auth_enabled():
        print(" 🔒 Authentication: ENABLED")
    else:
        print(" 🔓 Authentication: DISABLED (Public mode)")
    print("=" * 60)
    print(" Press Ctrl+C to stop the server\n")

    try:
        uvicorn.run(
            "fileforge.app:app",
            host=settings.host,
            port=settings.port,
            log_level="info",
            reload=False
        )
    except KeyboardInterrupt:
        print("\nStopping FileForge server. Goodbye!")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
