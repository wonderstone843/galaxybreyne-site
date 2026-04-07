#!/usr/bin/env python3
"""
Generate 3 explorable 3D worlds for galaxybreyne.com from Owl Noches concepts.
Uses Marble 1.1 Plus for the bigger/expanded world generation.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path

# ── Config ─────────────────────────────────────────────
API_KEY = "WlfGxEj4r65YXD1O8q3Jg5piAdrTjZML"
BASE_URL = "https://api.worldlabs.ai/marble/v1"
MODEL = "marble-1.1-plus"  # The new bigger-worlds model

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

IMAGES = [
    {
        "path": "/Volumes/Expansion/creative-studio-backup/creative-studio/owl_noches/concepts/v10_final_expansion/ext_04_aerial_massive.png",
        "name": "galaxybreyne_hero_aerial_massive_dome",
        "role": "HERO — Massive aerial dome city at golden hour",
    },
    {
        "path": "/Volumes/Expansion/creative-studio-backup/creative-studio/owl_noches/concepts/v10_final_expansion/ext_03_aerial_dome.png",
        "name": "galaxybreyne_services_aerial_dome_night",
        "role": "SERVICES SECTION — Moonlit aerial dome stylized",
    },
    {
        "path": "/Volumes/Expansion/creative-studio-backup/creative-studio/owl_noches/concepts/v10_final_expansion/approach_01.png",
        "name": "galaxybreyne_portfolio_approach_highway",
        "role": "PORTFOLIO SECTION — Driving approach to the dome at night",
    },
]

# Delay between successful generations (avoid potential rate-limit triggering 402)
DELAY_BETWEEN_GENS_SEC = 30

HEADERS = {
    "WLT-Api-Key": API_KEY,
    "Content-Type": "application/json",
}


# ── API helpers ────────────────────────────────────────
def prepare_upload(image_path):
    """Get a signed upload URL from World Labs."""
    path = Path(image_path)
    ext = path.suffix.lstrip(".").lower()
    if ext == "jpeg":
        ext = "jpg"

    payload = {
        "file_name": path.name,
        "kind": "image",
        "extension": ext,
        "metadata": {},
    }
    r = requests.post(
        f"{BASE_URL}/media-assets:prepare_upload",
        headers=HEADERS,
        json=payload,
    )
    r.raise_for_status()
    return r.json()


def upload_file(image_path, upload_info):
    """Upload the file bytes to the signed URL."""
    upload_url = upload_info["upload_info"]["upload_url"]
    required = upload_info["upload_info"].get("required_headers", {})

    ext = Path(image_path).suffix.lower()
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    headers = {"Content-Type": content_types.get(ext, "application/octet-stream")}
    headers.update(required)

    with open(image_path, "rb") as f:
        data = f.read()

    r = requests.put(upload_url, headers=headers, data=data)
    r.raise_for_status()
    return True


def generate_world(image_path, display_name):
    """Kick off world generation using Marble 1.1 Plus."""
    print(f"\n[{display_name}]")
    print(f"  Source: {Path(image_path).name}")

    print(f"  Preparing upload...")
    upload_info = prepare_upload(image_path)
    media_asset_id = upload_info["media_asset"]["media_asset_id"]

    print(f"  Uploading image...")
    upload_file(image_path, upload_info)

    print(f"  Starting generation with model={MODEL}...")
    payload = {
        "world_prompt": {
            "type": "image",
            "image_prompt": {
                "source": "media_asset",
                "media_asset_id": media_asset_id,
            },
        },
        "display_name": display_name,
        "model": MODEL,
        "permission": {"public": True},  # public so we can embed on the site
    }

    r = requests.post(
        f"{BASE_URL}/worlds:generate",
        headers=HEADERS,
        json=payload,
    )
    r.raise_for_status()
    result = r.json()
    op_id = result.get("operation_id")
    print(f"  Operation started: {op_id}")
    return op_id


def poll_until_done(operation_id, timeout_minutes=15):
    """Poll the operation until it finishes."""
    start = time.time()
    timeout = timeout_minutes * 60
    last_elapsed = 0

    while True:
        elapsed = int(time.time() - start)
        if elapsed > timeout:
            raise TimeoutError(f"Timed out after {timeout_minutes} minutes")

        r = requests.get(
            f"{BASE_URL}/operations/{operation_id}",
            headers=HEADERS,
        )
        r.raise_for_status()
        result = r.json()

        if result.get("done"):
            if result.get("error"):
                raise Exception(f"Generation failed: {result['error']}")
            print(f"  ✓ Complete in {elapsed}s")
            return result

        # Only print update every 30 seconds
        if elapsed - last_elapsed >= 30:
            print(f"  ... still generating ({elapsed}s elapsed)")
            last_elapsed = elapsed

        time.sleep(15)


def get_world(world_id):
    """Fetch the completed world details + embed URL."""
    r = requests.get(
        f"{BASE_URL}/worlds/{world_id}",
        headers=HEADERS,
    )
    r.raise_for_status()
    return r.json()


# ── Main ───────────────────────────────────────────────
def main():
    print("═" * 60)
    print("  GALAXYBREYNE — World Labs 1.1 Plus Generation")
    print(f"  Model: {MODEL}")
    print(f"  Output: {OUTPUT_DIR}")
    print("═" * 60)

    # Verify all source images exist first
    for img in IMAGES:
        if not Path(img["path"]).exists():
            print(f"ERROR: Missing source image: {img['path']}")
            sys.exit(1)

    summary = []
    stop_due_to_payment = False

    for i, img in enumerate(IMAGES):
        if stop_due_to_payment:
            print(f"\n⊘ Skipping {img['role']} — halted on previous 402 Payment Required")
            summary.append({
                "role": img["role"],
                "name": img["name"],
                "status": "skipped",
                "reason": "halted after 402",
            })
            continue

        # Add delay between generations (after the first one)
        if i > 0:
            print(f"\n⏳ Waiting {DELAY_BETWEEN_GENS_SEC}s before next generation...")
            time.sleep(DELAY_BETWEEN_GENS_SEC)

        try:
            print(f"\n━━ {img['role']} ━━")
            op_id = generate_world(img["path"], img["name"])
            completed = poll_until_done(op_id, timeout_minutes=15)

            # Extract world_id from the operation response
            world_id = completed.get("response", {}).get("world_id") or completed.get("response", {}).get("id")

            if world_id:
                world_data = get_world(world_id)
                print(f"  World ID: {world_id}")
            else:
                world_data = completed
                print(f"  (no world_id returned — using operation response)")

            # Save the full response
            out_file = OUTPUT_DIR / f"{img['name']}.json"
            with open(out_file, "w") as f:
                json.dump(world_data, f, indent=2)
            print(f"  Saved: {out_file.name}")

            summary.append({
                "role": img["role"],
                "name": img["name"],
                "world_id": world_id,
                "status": "success",
                "data_file": str(out_file),
            })

        except Exception as e:
            err_str = str(e)
            print(f"  ✗ FAILED: {err_str}")
            summary.append({
                "role": img["role"],
                "name": img["name"],
                "status": "failed",
                "error": err_str,
            })
            # If it's a payment error, stop immediately to avoid wasting more API calls
            if "402" in err_str or "Payment" in err_str:
                print(f"\n  ⚠ 402 Payment Required detected — halting remaining generations")
                stop_due_to_payment = True

    # Print final summary
    print("\n" + "═" * 60)
    print("  GENERATION SUMMARY")
    print("═" * 60)
    for s in summary:
        status_mark = "✓" if s["status"] == "success" else "✗"
        print(f"  {status_mark} {s['role']}")
        if s.get("world_id"):
            print(f"      world_id: {s['world_id']}")
        if s.get("error"):
            print(f"      error:    {s['error']}")

    # Save summary
    summary_file = OUTPUT_DIR / "_SUMMARY.json"
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\n  Summary saved: {summary_file}")
    print()


if __name__ == "__main__":
    main()
