"""Windows launcher for the packaged suvhlatex application."""

from __future__ import annotations

import os
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path


def user_data_dir() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    path = base / "suvhlatex"
    path.mkdir(parents=True, exist_ok=True)
    return path


def wait_for_server(url: str, worker: threading.Thread) -> bool:
    deadline = time.monotonic() + 15
    while worker.is_alive() and time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=0.5):
                return True
        except Exception:
            time.sleep(0.2)
    return False


def main() -> None:
    data_dir = user_data_dir()
    os.environ.setdefault("SUVHLATEX_DATA", str(data_dir / "data"))
    os.environ.setdefault("SUVHLATEX_ENV_FILE", str(data_dir / ".env"))
    os.environ.setdefault("SUVHLATEX_CONFIG", str(data_dir / "config.json"))

    log_path = data_dir / "suvhlatex.log"
    with log_path.open("a", encoding="utf-8") as log:
        sys.stdout = log
        sys.stderr = log

        from server import HOST, PORT, main as server_main

        worker = threading.Thread(target=server_main, name="suvhlatex-server", daemon=True)
        worker.start()
        url = f"http://{HOST}:{PORT}"
        if wait_for_server(url, worker):
            webbrowser.open(url)
        worker.join()


if __name__ == "__main__":
    main()
