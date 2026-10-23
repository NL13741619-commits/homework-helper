"""Stitch clips into one video. Uses ffmpeg."""
import subprocess
import sys
from pathlib import Path


def stitch(clips, out):
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    lst = out.with_suffix(".txt")
    lst.write_text("\n".join(f"file '{Path(c).resolve()}'" for c in clips), encoding="utf-8")
    subprocess.check_call([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(lst), "-c", "copy", str(out)
    ])
    lst.unlink(missing_ok=True)
    return str(out)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: stitch.py out.mp4 clip1.mp4 clip2.mp4 ...")
        sys.exit(1)
    print(stitch(sys.argv[2:], sys.argv[1]))
