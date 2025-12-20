import cv2
import base64
import requests
import time
import uuid
import os
import json
import threading
import queue

# --- KONFIGURASI ---
API_URL = "https://smart-eye-d5g3.onrender.com/process_frame" # Pastikan URL Benar
CONFIG_FILE = "device_config.json"
FRAME_WIDTH = 320  # Perkecil resolusi agar pengiriman cepat
FRAME_HEIGHT = 240
JPEG_QUALITY = 60  # Kurangi kualitas JPG (0-100) untuk hemat bandwidth

# Queue untuk pertukaran data antar thread (hanya simpan 1 frame terbaru)
frame_queue = queue.Queue(maxsize=1)

def get_or_create_hardware_id():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                if 'hardware_id' in config:
                    return config['hardware_id']
        except:
            pass
    new_id = str(uuid.uuid4())
    with open(CONFIG_FILE, 'w') as f:
        json.dump({'hardware_id': new_id}, f)
    return new_id

def send_frame_worker(hardware_id):
    """Fungsi ini berjalan di thread terpisah khusus untuk mengirim data ke internet"""
    print("[INFO] Thread pengirim data berjalan...")
    
    while True:
        try:
            # Ambil frame terbaru dari antrian (tunggu jika kosong)
            payload = frame_queue.get()
            
            # Kirim request (Proses ini bisa makan waktu 0.5 - 2 detik, tapi tidak bikin kamera lag)
            try:
                response = requests.post(API_URL, json=payload, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    # Optional: Print status sesekali saja agar tidak spam
                    # print(f"Server: {data.get('message', 'OK')} | Blink: {data.get('blink_rate', 0)}")
                else:
                    print(f"[!] Server Error: {response.status_code}")
            except requests.exceptions.Timeout:
                print("[!] Timeout koneksi (skip frame)")
            except Exception as e:
                print(f"[!] Error kirim: {e}")
                time.sleep(1) # Tunggu sebentar jika error koneksi

        except Exception as e:
            print(f"[Error Worker] {e}")

def run_camera():
    hardware_id = get_or_create_hardware_id()
    
    cap = cv2.VideoCapture(0)
    # Set resolusi kamera di hardware level (jika didukung)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)

    print("="*40)
    print(f"   SMART-EYE CAMERA CLIENT (THREADED)")
    print(f"   ID: {hardware_id}")
    print(f"   Target: {API_URL}")
    print("="*40)

    # Jalankan thread pengirim data
    t = threading.Thread(target=send_frame_worker, args=(hardware_id,))
    t.daemon = True # Agar thread mati otomatis saat program utama stop
    t.start()

    last_send_time = 0
    SEND_INTERVAL = 0.1 # Batasi pengiriman maksimal 10 FPS agar antrian tidak penuh (opsional)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Gagal membaca kamera")
            break
            
        # Tampilkan preview kamera (Local) - Ini akan selalu lancar
        cv2.imshow("Smart Eye - Preview", frame)

        now = time.time()
        # Kirim frame ke thread worker (jika queue kosong & interval terpenuhi)
        if (now - last_send_time) > SEND_INTERVAL:
            if frame_queue.empty():
                # 1. Resize lagi untuk memastikan kecil
                resized_frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
                
                # 2. Kompresi JPEG (PENTING: Kurangi kualitas untuk kecepatan)
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
                _, buffer = cv2.imencode('.jpg', resized_frame, encode_param)
                
                jpg_as_text = base64.b64encode(buffer).decode('utf-8')
                
                payload = {
                    'image': f"data:image/jpeg;base64,{jpg_as_text}",
                    'hardware_id': hardware_id,
                    'mode': 'focus' 
                }
                
                # Masukkan ke antrian untuk dikirim thread sebelah
                frame_queue.put(payload)
                last_send_time = now

        # Tombol 'q' untuk keluar
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    run_camera()