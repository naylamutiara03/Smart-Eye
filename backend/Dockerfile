FROM python:3.10-slim

# Install system dependencies required by MediaPipe
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render uses port 10000 by default
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "app:app"]
