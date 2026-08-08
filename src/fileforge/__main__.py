"""Main entry point for running fileforge as a python module (python -m fileforge)."""

import sys
from fileforge.cli import main

if __name__ == "__main__":
    sys.exit(main())
