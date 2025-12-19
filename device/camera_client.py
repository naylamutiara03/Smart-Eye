import cv2
import base64
import requests
import time
import uuid
import os
import json

API_URL = "https://smart-eye-n58f.onrender.com/process_frame"
CONFIG_FILE = "device_config.json"

def get_or_create_hardware_id():
    # Cek apakah ID sudah pernah dibuat sebelumnya
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                if 'hardware_id' in config:
                    return config['hardware_id']
        except:
            pass # Jika error, buat baru
            
    # Buat ID baru jika belum ada
    new_id = str(uuid.uuid4())
    with open(CONFIG_FILE, 'w') as f:
        json.dump({'hardware_id': new_id}, f)
    return new_id

def run_camera():
    # 1. Dapatkan ID Unik Perangkat ini
    hardware_id = get_or_create_hardware_id()
    
    cap = cv2.VideoCapture(0)
    print("="*40)
    print(f"   SMART-EYE CAMERA CLIENT")
    print(f"   ID: {hardware_id}")
    print(f"   Target: {API_URL}")
    print("="*40)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Gagal membaca kamera")
            break
            
        # Resize frame agar pengiriman lebih ringan
        frame = cv2.resize(frame, (480, 360))
        _, buffer = cv2.imencode('.jpg', frame)
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        
        # Kirim frame ke backend BESERTA hardware_id
        try:
            payload = {
                'image': f"data:image/jpeg;base64,{jpg_as_text}",
                'hardware_id': hardware_id,
                'mode': 'focus' 
            }
            
            response = requests.post(API_URL, json=payload, timeout=15)
            print(".", end="", flush=True)
            
        except requests.exceptions.ConnectionError:
            print("\r[!] Gagal koneksi ke server...", end="")
        except Exception as e:
            print(f"\n[!] Error: {e}")
            
        time.sleep(0.1) # 10 FPS

    cap.release()

if __name__ == "__main__":
    run_camera()