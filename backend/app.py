from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2, dlib, numpy as np, base64, re, time, datetime
from supabase_client import supabase
from collections import deque

app = Flask(__name__)
CORS(app)

# --- Inisialisasi Model Dlib ---
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("shape_predictor_68_face_landmarks.dat")

# --- Variabel Global ---
EAR_THRESHOLD = 0.20
TOTAL_BLINKS = 0
LAST_BLINK_TIME = time.time()
START_TIME = None
BLINK_TIMESTAMPS = deque()
EYE_CLOSED = False

# Sementara hardcode, nanti ganti dari Auth Context
USER_ID = 1
DEVICE_ID = 2

def eye_aspect_ratio(eye):
    A = np.linalg.norm(eye[1] - eye[5])
    B = np.linalg.norm(eye[2] - eye[4])
    C = np.linalg.norm(eye[0] - eye[3])
    return (A + B) / (2.0 * C)


@app.route('/')
def api_home():
    return jsonify({"message": "Smart-Eye Blink Detection API is running!"})


@app.route('/history', methods=['GET'])
def get_history():
    """Ambil riwayat kedipan dari tabel blink_history"""
    try:
        response = (
            supabase.table("blink_history")
            .select("*")
            .order("captured_at", desc=True)
            .limit(20)
            .execute()
        )
        return jsonify(response.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/process_frame', methods=['POST'])
def process_frame():
    global TOTAL_BLINKS, LAST_BLINK_TIME, START_TIME, EYE_CLOSED, BLINK_TIMESTAMPS

    if START_TIME is None:
        START_TIME = time.time()
        LAST_BLINK_TIME = time.time()
        BLINK_TIMESTAMPS.clear()
        EYE_CLOSED = False

    data = request.get_json()
    img_str = re.search(r'base64,(.*)', data['image']).group(1)
    nparr = np.frombuffer(base64.b64decode(img_str), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    faces = detector(gray)
    message = "Wajah tidak terdeteksi."
    blink_count = 0  # default agar tidak undefined

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

        blink_count = len(BLINK_TIMESTAMPS)

        # Hitung blink rate (kedipan per menit)
        elapsed_time = now - START_TIME
        blink_rate = round((TOTAL_BLINKS / elapsed_time) * 60, 2) if elapsed_time > 0 else 0

        if now - LAST_BLINK_TIME > 10:
            message = "⚠️ Anda sudah lama tidak berkedip. Istirahatkan mata Anda!"
        elif blink_count > 30:
            message = "⚠️ Kedipan terlalu sering. Mungkin mata Anda lelah."
        else:
            message = "Deteksi berjalan normal."

        return jsonify({
            "message": message,
            "total_blinks": TOTAL_BLINKS,
            "blink_count": blink_count,
            "blink_rate": blink_rate  # 🟢 Tambahkan ini
        })

    # Jika wajah tidak terdeteksi
    return jsonify({
        "message": message,
        "total_blinks": TOTAL_BLINKS,
        "blink_count": blink_count,
        "blink_rate": 0  # 🟢 Default agar frontend tidak undefined
    })


@app.route('/stop_detection', methods=['POST'])
def stop_detection():
    global TOTAL_BLINKS, START_TIME

    if START_TIME is None:
        return jsonify({"error": "Detection never started"}), 400

    duration_sec = int(time.time() - START_TIME)
    blink_per_minute = round((TOTAL_BLINKS / (duration_sec / 60)), 2) if duration_sec > 0 else 0.0
    warning_triggered = TOTAL_BLINKS == 0 or blink_per_minute < 10  # contoh logika sederhana

    if duration_sec > 10 and TOTAL_BLINKS > 0:
        record = {
            "blink_count": TOTAL_BLINKS,
            "stare_duration_sec": duration_sec,
            "blink_per_minute": int(blink_per_minute),
            "warning_triggered": warning_triggered,
            "note": "Auto-saved from Smart Eye",
            "captured_at": datetime.datetime.utcnow().isoformat(),
            "user_id": USER_ID,
            "device_id": DEVICE_ID,
            "created_at": datetime.datetime.utcnow().isoformat()
        }
        try:
            supabase.table("blink_history").insert(record).execute()
        except Exception as e:
            print(f"Error saving to Supabase: {e}")

    response_data = {
        "total_blinks": TOTAL_BLINKS,
        "duration_sec": duration_sec,
        "blink_per_minute": blink_per_minute
    }

    # Reset state
    TOTAL_BLINKS = 0
    START_TIME = None

    return jsonify(response_data)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
