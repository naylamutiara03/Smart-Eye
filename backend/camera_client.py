# camera_client.py (Skrip terpisah, BUKAN app.py)
import cv2
import base64
import requests
import time

API_URL = "http://127.0.0.1:5000/process_frame"

cap = cv2.VideoCapture(0) # 0 = Kamera default

while True:
    ret, frame = cap.read()
    if not ret:
        break
        
    # Mengubah frame menjadi Base64
    _, buffer = cv2.imencode('.jpg', frame)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    
    # Kirim ke API Flask
    try:
        response = requests.post(API_URL, json={'image': f"data:image/jpeg;base64,{jpg_as_text}"})
        
        # Tampilkan respon dari API
        print(response.json()['message'])
        print(f"Total Blinks: {response.json()['total_blinks']}")
        
    except requests.exceptions.ConnectionError:
        print("API server is not running.")
        
    time.sleep(0.1) # Kirim setiap 100ms