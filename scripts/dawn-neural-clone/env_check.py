#!/usr/bin/env python3
"""Env check for Dawn neural clone. Does not synthesize. Does not mark AVAILABLE."""
from __future__ import annotations
import hashlib
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / "app/assets/dawn-voice/dawn-natural-female-v3-speak.wav"
EXPECTED = "c42a877c6af9cb48384e4b9a8bf3d24aac137107faf49d5201955df69398cf1d"

def main() -> int:
    print("dawn-neural-clone env_check")
    print("ref_path", REF)
    print("ref_exists", REF.is_file())
    if REF.is_file():
        sha = hashlib.sha256(REF.read_bytes()).hexdigest()
        print("sha256", sha)
        print("sha_ok", sha == EXPECTED)
    paid = os.environ.get("DAWN_ALLOW_PAID_TTS", "")
    if paid.lower() in ("1", "true", "yes"):
        print("REFUSE: DAWN_ALLOW_PAID_TTS is set — Phase A paid gate deny for product path")
        return 2
    print("paid_api", "refused_by_policy")
    try:
        import torch
        print("torch", torch.__version__)
        print("cuda_available", torch.cuda.is_available())
        if torch.cuda.is_available():
            print("gpu", torch.cuda.get_device_name(0))
            print("next", "OK to run Qwen3-TTS / CosyVoice on this machine")
        else:
            print("next", "BLOCKED_NEED_GPU — use Colab free T4 notebook or a GPU host")
    except ImportError:
        print("torch", "not_installed")
        print("next", "BLOCKED_NEED_GPU — use Colab notebook (installs its own deps)")
    print("product_status", "NOT_AVAILABLE")
    print("gemini_live", "forbidden_for_product")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
