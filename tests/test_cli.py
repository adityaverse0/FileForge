import subprocess
import sys

def test_cli_version():
    res = subprocess.run([sys.executable, "-m", "fileforge", "--version"], capture_output=True, text=True)
    assert res.returncode == 0
    assert "FileForge" in res.stdout or "FileForge" in res.stderr

def test_cli_help():
    res = subprocess.run([sys.executable, "-m", "fileforge", "--help"], capture_output=True, text=True)
    assert res.returncode == 0
    assert "usage:" in res.stdout
