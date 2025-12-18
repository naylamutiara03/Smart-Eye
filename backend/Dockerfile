FROM python:3.9-slim

# Install system dependencies
# Kita tambahkan --no-install-recommends agar lebih hemat storage
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements dulu biar caching layer docker jalan
COPY requirements.txt .

# Upgrade pip agar proses install lebih efisien
RUN pip install --upgrade pip

# Install requirements dengan timeout lebih lama dan tanpa cache
# (Ini membantu jika server lambat saat compile dlib)
RUN pip install --no-cache-dir -r requirements.txt --default-timeout=1000

COPY . .

CMD ["gunicorn", "-b", "0.0.0.0:10000", "app:app"]