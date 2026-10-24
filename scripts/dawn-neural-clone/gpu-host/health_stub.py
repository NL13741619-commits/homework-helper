#!/usr/bin/env python3
"""Honest Dawn TTS host stub: never reports AVAILABLE without CUDA + weights.

GET /health  → JSON with status BLOCKED_NEED_GPU when no CUDA (default on this box)
POST /v1/audio/speech → 503 BLOCKED_NEED_GPU

Optional Bearer check if AIVAULT_VOICE_TOKEN is set (≥1 char); empty token = open local probe only.
"""
from __future__ import annotations

import json
import os
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def cuda_available() -> bool:
    try:
        import torch  # type: ignore

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def health_payload() -> dict:
    has_cuda = cuda_available()
    # Even with CUDA, this stub does not load weights — still not product-ready.
    ready = False
    status = "BLOCKED_NEED_GPU" if not has_cuda else "BLOCKED_NEED_WEIGHTS_OR_ENGINE"
    return {
        "engine": "dawn-gpu-host-stub",
        "ready": ready,
        "status": status,
        "product_tts": "NOT_AVAILABLE",
        "available": False,
        "cuda": has_cuda,
        "provider": "self_hosted_stub",
        "next_step": (
            "Provision NVIDIA host; run app/services/aivault-voice/engine.py with v3 ref; "
            "LIVE ear-check; never mark AVAILABLE until then"
        ),
        "docs": "docs/GPU-LIVE-TTS-HOST-PLAN.md",
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
