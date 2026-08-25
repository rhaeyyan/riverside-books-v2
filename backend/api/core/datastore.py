"""Atomic JSON datastore with granular per-collection locking."""

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any


class JsonDatastore:
    """Thread-safe, atomic file I/O layer for JSON persistence."""

    def __init__(self, data_dir: Path | str = "mock_data") -> None:
        """Initialize datastore with target data directory.

        Args:
            data_dir: Path to directory containing JSON data files.
        """
        self.data_dir = Path(data_dir)
        self._global_lock = threading.Lock()
        self._locks: dict[str, threading.RLock] = {}

    def _get_lock(self, collection_name: str) -> threading.RLock:
        """Retrieve or create a reentrant lock for a specific collection.

        Args:
            collection_name: Name of the collection file (e.g. 'inventory.json').

        Returns:
            A threading.RLock instance dedicated to this collection.
        """
        with self._global_lock:
            if collection_name not in self._locks:
                self._locks[collection_name] = threading.RLock()
            return self._locks[collection_name]

    def get_lock(self, collection_name: str) -> threading.RLock:
        """Retrieve the lock for a collection to allow multi-step atomic operations.

        Args:
            collection_name: Name of the collection file (e.g. 'inventory.json').

        Returns:
            A threading.RLock instance dedicated to this collection.
        """
        return self._get_lock(collection_name)

    def load(self, collection_name: str) -> Any:
        """Thread-safely load and parse JSON from a collection file.

        Args:
            collection_name: Name of the collection file (e.g. 'inventory.json').

        Returns:
            Parsed JSON content (typically list or dict).

        Raises:
            FileNotFoundError: If the collection file does not exist.
        """
        lock = self._get_lock(collection_name)
        with lock:
            target_path = self.data_dir / collection_name
            if not target_path.exists():
                raise FileNotFoundError(
                    f"Collection file does not exist: {target_path}"
                )
            with open(target_path, encoding="utf-8") as f:
                return json.load(f)

    def save(self, collection_name: str, data: Any) -> None:
        """Thread-safely and atomically write data to a collection file.

        Writes first to a temporary file in the target directory and uses
        os.replace for atomic replacement, preventing partial writes and corruption.

        Args:
            collection_name: Name of the collection file (e.g. 'inventory.json').
            data: JSON-serializable Python data structure (list, dict, etc.).
        """
        lock = self._get_lock(collection_name)
        with lock:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            target_path = self.data_dir / collection_name

            # Create temp file in same directory to ensure atomic os.replace
            # across filesystems
            temp_fd, temp_path_str = tempfile.mkstemp(
                dir=self.data_dir,
                prefix=f".{target_path.name}.",
                suffix=".tmp",
            )
            temp_path = Path(temp_path_str)
            try:
                with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(temp_path, target_path)
            except Exception:
                if temp_path.exists():
                    temp_path.unlink(missing_ok=True)
                raise
