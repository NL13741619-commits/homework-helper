# Placeholder image: CPU-only health stub.
# Real inference image must install CUDA-matched PyTorch + qwen-tts
# and run app/services/aivault-voice/engine.py — not this stub.
FROM python:3.11-slim
WORKDIR /app
COPY health_stub.py /app/health_stub.py
ENV AIVAULT_VOICE_PORT=8090
EXPOSE 8090
CMD ["python", "/app/health_stub.py"]
