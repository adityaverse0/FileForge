# Contributing to FileForge

Thank you for considering contributing to FileForge!

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/fileforge/fileforge.git
   cd fileforge
   ```

2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -e ".[dev]"
   pip install pytest build twine
   ```

3. Run unit tests:
   ```bash
   pytest
   ```

4. Code formatting & checks:
   ```bash
   python -m compileall src
   python -m build
   python -m twine check dist/*
   ```
