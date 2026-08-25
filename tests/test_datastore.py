"""Tests for JsonDatastore atomic file I/O layer.

Includes per-collection concurrency locking and atomic write verification.
"""

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from backend.api.core.datastore import JsonDatastore


class TestJsonDatastore:
    """Tests for JsonDatastore generic persistence layer."""

    def test_save_and_load_collection(self, tmp_path: Path) -> None:
        """Test basic write-through and read operations."""
        store = JsonDatastore(data_dir=tmp_path)
        sample_data = [
            {"isbn": "9780143039433", "title": "The Grapes of Wrath"},
            {"isbn": "9780374605928", "title": "Tomorrow, and Tomorrow"},
        ]

        store.save("inventory.json", sample_data)
        loaded = store.load("inventory.json")

        assert loaded == sample_data

    def test_save_dict_collection(self, tmp_path: Path) -> None:
        """Test save and load with single dictionary object (e.g. store_info)."""
        store = JsonDatastore(data_dir=tmp_path)
        sample_info = {
            "name": "Riverside Books",
            "phone": "555-0142",
            "policies": {"returns": "14 days"},
        }

        store.save("store_info.json", sample_info)
        loaded = store.load("store_info.json")

        assert loaded == sample_info

    def test_atomic_write_leaves_no_temp_files(self, tmp_path: Path) -> None:
        """Test atomic write replaces cleanly without lingering temp files."""
        store = JsonDatastore(data_dir=tmp_path)
        data = [{"id": "cust_001", "name": "Alice"}]

        store.save("customers.json", data)

        target_file = tmp_path / "customers.json"
        assert target_file.exists()

        # Ensure no leftover *.tmp files in the directory
        tmp_files = list(tmp_path.glob("*.tmp")) + list(tmp_path.glob("*.tmp.*"))
        assert len(tmp_files) == 0, f"Found leftover temp files: {tmp_files}"

        # Ensure content is valid JSON
        with open(target_file, encoding="utf-8") as f:
            assert json.load(f) == data

    def test_concurrent_writes_same_collection(self, tmp_path: Path) -> None:
        """Test thread-safety when multiple threads write to same collection."""
        store = JsonDatastore(data_dir=tmp_path)
        collection_name = "concurrent_test.json"
        num_workers = 10
        iterations_per_worker = 10

        # Initialize empty collection
        store.save(collection_name, [])

        def worker_append(worker_id: int) -> None:
            for i in range(iterations_per_worker):
                # Lock and update collection
                # We expect save to write-through cleanly
                current = store.load(collection_name)
                assert isinstance(current, list)
                current.append({"worker": worker_id, "iteration": i})
                store.save(collection_name, current)

        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(worker_append, w) for w in range(num_workers)]
            for future in futures:
                future.result()

        final_data = store.load(collection_name)
        assert isinstance(final_data, list)
        # Ensure JSON is non-corrupt and valid
        target_file = tmp_path / collection_name
        with open(target_file, encoding="utf-8") as f:
            disk_data = json.load(f)
        assert disk_data == final_data

    def test_per_collection_locking_isolation(self, tmp_path: Path) -> None:
        """Test operations on distinct collections do not deadlock each other."""
        store = JsonDatastore(data_dir=tmp_path)

        def write_col_a() -> None:
            for i in range(20):
                store.save("col_a.json", [{"count": i}])
                assert store.load("col_a.json") == [{"count": i}]

        def write_col_b() -> None:
            for j in range(20):
                store.save("col_b.json", [{"count": j}])
                assert store.load("col_b.json") == [{"count": j}]

        thread_a = threading.Thread(target=write_col_a)
        thread_b = threading.Thread(target=write_col_b)

        thread_a.start()
        thread_b.start()

        thread_a.join(timeout=5)
        thread_b.join(timeout=5)

        assert not thread_a.is_alive(), "Thread A timed out / deadlocked"
        assert not thread_b.is_alive(), "Thread B timed out / deadlocked"

    def test_load_nonexistent_file_raises_filenotfound(self, tmp_path: Path) -> None:
        """Test that loading a non-existent file raises FileNotFoundError."""
        store = JsonDatastore(data_dir=tmp_path)
        with pytest.raises(FileNotFoundError):
            store.load("non_existent.json")
