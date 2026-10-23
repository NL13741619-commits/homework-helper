"""Dawn own image-to-video host. Skeleton only.
Replace generate() with a real open image-to-video model on a GPU host.
"""
import base64
import io
import os
import time
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
OUT = Path(os.environ.get("DAWN_VIDEO_OUT", "/tmp/dawn-video"))
OUT.mkdir(parents=True, exist_ok=True)


class Task(BaseModel):
    kind: str = "image_to_video_6s"
    prompt: str = ""
    duration_sec: int = 6
    reference_image: str | None = None


def generate(task: Task) -> Path:
    # Placeholder. Wire an open image-to-video model here.
    # Until then, write a marker file so the path exists.
    name = f"{int(time.time())}.mp4"
    path = OUT / name
    path.write_bytes(b"")
    return path


@app.get("/health")
def health():
    return {"ok": True, "owner": "dawn-light", "capability": "image_to_video_6s"}


@app.post("/produce")
def produce(task: Task):
    if task.kind == "image_to_video_6s" and not task.reference_image:
        return {"ok": False, "error": "MISSING_IMAGE", "kind": task.kind}
    path = generate(task)
    return {
        "ok": True,
        "kind": task.kind,
        "owned": True,
        "path": str(path),
        "note": "skeleton; replace generate() with real model",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7861")))
