FROM python:3.9-slim

# Install library sistem minimal untuk opencv (jauh lebih ringan dari dlib)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Jalankan aplikasi
CMD ["gunicorn", "-b", "0.0.0.0:10000", "app:app"]