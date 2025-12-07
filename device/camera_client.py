import cv2
import base64
import requests
import time

# Pastikan URL mengarah ke backend Anda
API_URL = "http://127.0.0.1:5000/process_frame"

def run_camera():
    cap = cv2.VideoCapture(0)
    print("--- KAMERA AKTIF ---")
    print(f"Mengirim data ke: {API_URL}")
    print("Jangan tutup window ini agar deteksi terus berjalan.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Gagal membaca kamera")
            break
            
        # Resize frame agar pengiriman lebih ringan (opsional)
        frame = cv2.resize(frame, (480, 360))
        
        _, buffer = cv2.imencode('.jpg', frame)
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        
        # Kirim frame ke backend
        try:
            # Kita tambahkan mode 'strict' atau 'focus' jika mau (opsional)
            payload = {
                'image': f"data:image/jpeg;base64,{jpg_as_text}",
                'mode': 'focus' 
            }
            
            response = requests.post(API_URL, json=payload, timeout=0.5)
            
            # Print feedback dari server (untuk debugging di terminal)
            data = response.json()
            print(f"\rStatus: {data.get('message')} | Blinks: {data.get('total_blinks')}", end="")
            
        except requests.exceptions.ConnectionError:
            print("\r[!] Gagal koneksi ke server...", end="")
        except Exception as e:
            print(f"\n[!] Error: {e}")
            
        # Kirim sekitar 10-15 FPS agar tidak memberatkan server
        time.sleep(0.08)

    cap.release()

if __name__ == "__main__":
    run_camera()