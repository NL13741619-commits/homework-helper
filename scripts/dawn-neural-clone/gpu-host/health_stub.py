#!/usr/bin/env python3
"""Honest Dawn TTS host stub: never reports AVAILABLE without real engine + ear-check.

GET /health  → JSON with status reflecting device probe (cuda / mps / cpu)
POST /v1/audio/speech → 503 (stub does not run inference)

Env:
  DAWN_DEVICE=cuda|mps|cpu  — preferred device hint (default: auto-detect)
  AIVAULT_VOICE_TOKEN       — optional Bearer; empty = open local probe
  AIVAULT_VOICE_HOST/PORT

Optional Bearer check if AIVAULT_VOICE_TOKEN is set (≥1 char); empty token = open local probe only.
"""
from __future__ import annotations

import json
import os
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def probe_torch() -> dict:
    """Return cuda / mps availability without loading TTS weights."""
    out = {
        "torch_installed": False,
        "cuda": False,
        "mps": False,
        "preferred": (os.environ.get("DAWN_DEVICE") or "").strip().lower() or "auto",
    }
    try:
        import torch  # type: ignore

        out["torch_installed"] = True
        out["cuda"] = bool(torch.cuda.is_available())
        mps_ok = False
        try:
            mps_ok = bool(
                getattr(torch.backends, "mps", None)
                and torch.backends.mps.is_available()
            )
        except Exception:
            mps_ok = False
        out["mps"] = mps_ok
    except Exception:
        pass
    return out


def resolve_device(probe: dict) -> str:
    pref = probe.get("preferred") or "auto"
    if pref in ("cuda", "mps", "cpu"):
        return pref
    if probe.get("cuda"):
        return "cuda"
    if probe.get("mps"):
        return "mps"
    return "cpu"


def health_payload() -> dict:
    probe = probe_torch()
    device = resolve_device(probe)
    has_cuda = bool(probe.get("cuda"))
    has_mps = bool(probe.get("mps"))

    # Stub never loads weights — never product-ready.
    ready = False
    available = False
    if has_cuda and device.startswith("cuda"):
        status = "BLOCKED_NEED_WEIGHTS_OR_ENGINE"
        next_step = (
            "CUDA seen; run app/services/aivault-voice/engine.py with v3 ref; "
            "LIVE ear-check; never mark AVAILABLE until then"
        )
    elif has_mps and device == "mps":
        status = "BLOCKED_MPS_EXPERIMENTAL_NEED_ENGINE"
        next_step = (
            "Apple MPS seen; try engine.py --device mps (may fail); "
            "Mac sleep kills host; NOT product AVAILABLE — see docs/DAWN-MAC-TTS-HOST-RUNBOOK.zh-TW.md"
        )
    elif device == "cpu":
        status = "BLOCKED_NEED_GPU"
        next_step = (
            "CPU-only / no accelerator; offline eval only. "
            "Use NVIDIA host, or Mac MPS trial, or paid cloud AFTER explicit $ approval"
        )
    else:
        # User forced cuda/mps but probe says missing
        status = "BLOCKED_NEED_GPU"
        next_step = (
            f"DAWN_DEVICE={device} requested but accelerator not available; "
            "fix DAWN_DEVICE or use another machine"
        )

    return {
        "engine": "dawn-gpu-host-stub",
        "ready": ready,
        "status": status,
        "product_tts": "NOT_AVAILABLE",
        "available": available,
        "device": device,
        "dawn_device_env": probe.get("preferred"),
        "cuda": has_cuda,
        "mps": has_mps,
        "torch_installed": probe.get("torch_installed"),
        "provider": "self_hosted_stub",
        "next_step": next_step,
        "docs": [
            "docs/GPU-LIVE-TTS-HOST-PLAN.md",
            "docs/DAWN-MAC-TTS-HOST-RUNBOOK.zh-TW.md",
            "scripts/dawn-neural-clone/gpu-host/README-MAC.zh-TW.md",
        ],
        "gemini_live": False,
        "browser_speech_synthesis": False,
    }


class Handler(BaseHTTPRequestHandler):
    token = os.environ.get("AIVAULT_VOICE_TOKEN", "")

    def _send(self, code: int, body, mime: str = "application/json") -> None:
        raw = (
            json.dumps(body, ensure_ascii=False).encode("utf-8")
            if isinstance(body, dict)
            else body
        )
        self.send_response(code)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _authorized(self) -> bool:
        if not self.token:
            return True  # local probe without token
        got = self.headers.get("Authorization", "")
        return secrets.compare_digest(got, "Bearer " + self.token)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] != "/health":
            self._send(404, {"error": "not_found"})
            return
        if not self._authorized():
            self._send(401, {"error": "unauthorized"})
            return
        self._send(200, health_payload())

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/v1/audio/speech":
            self._send(404, {"error": "not_found"})
            return
        if not self._authorized():
            self._send(401, {"error": "unauthorized"})
            return
        # Drain body
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n > 0:
                self.rfile.read(min(n, 24000))
        except Exception:
            pass
        payload = health_payload()
        payload["ok"] = False
        payload["inference_executed"] = False
        payload["error"] = payload["status"]
        self._send(503, payload)

    def log_message(self, fmt: str, *args) -> None:
        pass


def main() -> None:
    host = os.environ.get("AIVAULT_VOICE_HOST", "127.0.0.1")
    port = int(os.environ.get("AIVAULT_VOICE_PORT", "8090"))
    print(
        json.dumps(
            {"listening": f"http://{host}:{port}", **health_payload()},
            ensure_ascii=False,
        ),
        flush=True,
    )
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
