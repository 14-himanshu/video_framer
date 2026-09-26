# VideoFarm AI Video Engine - Backend Dockerfile
FROM python:3.12-slim

# Install system dependencies (FFmpeg is mandatory for video rendering)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Set environment defaults
ENV PYTHONUNBUFFERED=1
ENV OUTPUT_DIR=/app/output

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
