import json
import time
import os

def profile_disk_io():
    file_path = "scripts/load_test_data.json"

    print("Starting HDD Write Profiling...")

    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found. Please run the generation script first.")
        return

    print(f"Loading data from {file_path} into memory...")
    with open(file_path, "r") as f:
        data = json.load(f)

    print(f"Loaded {len(data)} records.")

    profiling_path = "scripts/profile_test_output.json"

    print("\n--- Benchmarking JSON Serialization ---")
    start_serialize = time.time()
    serialized_data = json.dumps(data)
    serialize_time = time.time() - start_serialize
    print(f"Serialization Time: {serialize_time:.4f} seconds")

    total_bytes = len(serialized_data.encode('utf-8'))
    total_mb = total_bytes / (1024 * 1024)
    print(f"Total Size: {total_mb:.2f} MB")

    print("\n--- Benchmarking Sequential Disk Write ---")
    chunk_size = 10000  # Number of records per chunk for latency measurement

    start_write = time.time()

    with open(profiling_path, "w") as f:
        # Instead of dumping the whole thing at once, we'll write it manually to measure chunks
        # This simulates a streaming write scenario to measure latency
        f.write("[")
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i+chunk_size]
            chunk_start = time.time()

            chunk_str = json.dumps(chunk)[1:-1] # Strip the outer brackets []

            # Add commas between chunks if it's not the first chunk
            if i > 0 and chunk_str:
                f.write(",")

            if chunk_str:
                f.write(chunk_str)

            # ensure it's written to disk
            f.flush()
            os.fsync(f.fileno())

            chunk_time = time.time() - chunk_start
            print(f"  Wrote chunk {i//chunk_size + 1} (records {i} to {min(i+chunk_size, len(data))-1}) in {chunk_time:.4f}s")

        f.write("]")

    write_time = time.time() - start_write

    print("\n--- Profiling Summary ---")
    print(f"Total Disk Write Time: {write_time:.4f} seconds")
    if write_time > 0:
        print(f"Sequential Write Speed: {(total_mb / write_time):.2f} MB/s")

    # Clean up the profiling file
    if os.path.exists(profiling_path):
        os.remove(profiling_path)
        print("\nCleaned up temporary profiling file.")

if __name__ == "__main__":
    profile_disk_io()
