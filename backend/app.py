from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS
import cv2, dlib, numpy as np, base64, re, time, datetime
from supabase_client import supabase
from collections import deque

app = Flask(__name__)
CORS(app) # Aktifkan CORS untuk semua route

# --- Inisialisasi Model Dlib (tetap sama) ---
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("shape_predictor_68_face_landmarks.dat")

# --- Variabel Global & Fungsi (tetap sama) ---
EAR_THRESHOLD = 0.20
TOTAL_BLINKS = 0
LAST_BLINK_TIME = time.time()
START_TIME = None
BLINK_TIMESTAMPS = deque()
EYE_CLOSED = False

def eye_aspect_ratio(eye):
    A = np.linalg.norm(eye[1] - eye[5])
    B = np.linalg.norm(eye[2] - eye[4])
    C = np.linalg.norm(eye[0] - eye[3])
    return (A + B) / (2.0 * C)

# --- API Endpoints ---

@app.route('/')
def api_home():
    # Endpoint dasar untuk mengecek apakah API berjalan
    return jsonify({"message": "EyeCare API is running!"})

@app.route('/history', methods=['GET'])
def get_history():
    # Mengambil data dari Supabase dan mengembalikannya sebagai JSON
    try:
        response = supabase.table("blink_history").select("*").order("time", desc=True).limit(20).execute()
        records = response.data
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/process_frame', methods=['POST'])
def process_frame():
    # Logika ini sebagian besar tetap sama, karena sudah memproses dan mengembalikan JSON
    global TOTAL_BLINKS, LAST_BLINK_TIME, START_TIME, EYE_CLOSED, BLINK_TIMESTAMPS

    if START_TIME is None:
        START_TIME = time.time()
        LAST_BLINK_TIME = time.time() # Inisialisasi last blink time
        BLINK_TIMESTAMPS.clear()
        EYE_CLOSED = False

    data = request.get_json()
    img_str = re.search(r'base64,(.*)', data['image']).group(1)
    nparr = np.frombuffer(base64.b64decode(img_str), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    faces = detector(gray)
    message = "Wajah tidak terdeteksi." # Pesan default

    if len(faces) > 0:
      for face in faces:
          landmarks = predictor(gray, face)
          left_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(36, 42)])
          right_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(42, 48)])
          ear = (eye_aspect_ratio(left_eye) + eye_aspect_ratio(right_eye)) / 2.0

          if ear < EAR_THRESHOLD and not EYE_CLOSED:
              EYE_CLOSED = True
          elif ear >= EAR_THRESHOLD and EYE_CLOSED:
              TOTAL_BLINKS += 1
              LAST_BLINK_TIME = time.time()
              EYE_CLOSED = False
              BLINK_TIMESTAMPS.append(LAST_BLINK_TIME)

      now = time.time()
      while BLINK_TIMESTAMPS and now - BLINK_TIMESTAMPS[0] > 60:
          BLINK_TIMESTAMPS.popleft()

      blink_rate = len(BLINK_TIMESTAMPS)

      if now - LAST_BLINK_TIME > 10: # Peringatan jika tidak berkedip selama 10 detik
          message = "⚠️ Anda sudah lama tidak berkedip. Istirahatkan mata Anda!"
      elif blink_rate > 30:
          message = "⚠️ Kedipan terlalu sering. Mungkin mata Anda lelah."
      else:
          message = "Deteksi berjalan normal."
    
    return jsonify({
        "message": message,
        "total_blinks": TOTAL_BLINKS,
        "blink_rate": blink_rate
    })


@app.route('/stop_detection', methods=['POST']) # Ubah ke POST untuk konsistensi
def stop_detection():
    global TOTAL_BLINKS, START_TIME

    if START_TIME is None:
        return jsonify({"error": "Detection never started"}), 400

    duration = int(time.time() - START_TIME)
    
    # Hanya simpan jika durasi lebih dari beberapa detik, misal 10 detik
    if duration > 10 and TOTAL_BLINKS > 0:
        record = {
            "time": datetime.datetime.now().isoformat(),
            "blinks": TOTAL_BLINKS,
            "duration": duration
        }
        try:
            supabase.table("blink_history").insert(record).execute()
        except Exception as e:
            print(f"Error saving to Supabase: {e}")

    response_data = {"total_blinks": TOTAL_BLINKS, "duration": duration}

    # Reset state
    TOTAL_BLINKS = 0
    START_TIME = None
    
    return jsonify(response_data)

if __name__ == '__main__':
    app.run(debug=True, port=5000) # Jalankan di port 5000