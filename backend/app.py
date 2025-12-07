from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2, dlib, numpy as np, base64, re, time
from datetime import datetime, timedelta, UTC
from supabase_client import supabase
from collections import deque

app = Flask(__name__)
CORS(app)

# --- Inisialisasi Model Dlib ---
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("shape_predictor_68_face_landmarks.dat")

# --- Variabel Global Statis ---
BASE_EAR_THRESHOLD = 0.20
TOTAL_BLINKS = 0
LAST_BLINK_TIME = time.time()
START_TIME = None
BLINK_TIMESTAMPS = deque()
EYE_CLOSED = False


def eye_aspect_ratio(eye):
    """Hitung Eye Aspect Ratio (EAR)"""
    A = np.linalg.norm(eye[1] - eye[5])
    B = np.linalg.norm(eye[2] - eye[4])
    C = np.linalg.norm(eye[0] - eye[3])
    return (A + B) / (2.0 * C)


@app.route('/')
def api_home():
    return jsonify({"message": "Smart-Eye Blink Detection API is running!"})


@app.route('/history', methods=['GET'])
def get_history():
    user_id = request.args.get('user_id')

    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    try:
        response = (
            supabase.table("blink_history")
            .select("*")
            .eq("user_id", user_id)
            .order("captured_at", desc=True)
            .limit(20)
            .execute()
        )
        return jsonify(response.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/process_frame', methods=['POST'])
def process_frame():
    global TOTAL_BLINKS, LAST_BLINK_TIME, START_TIME, EYE_CLOSED, BLINK_TIMESTAMPS, BASE_EAR_THRESHOLD

    data = request.get_json()

    detection_mode = data.get('mode', 'focus')

    if detection_mode == 'strict':
        ear_threshold = 0.22
        stare_time_limit = 8
        warning_blink_rate = 8
    else:
        ear_threshold = BASE_EAR_THRESHOLD
        stare_time_limit = 10
        warning_blink_rate = 10

    if START_TIME is None:
        START_TIME = time.time()
        LAST_BLINK_TIME = time.time()
        BLINK_TIMESTAMPS.clear()
        EYE_CLOSED = False

    try:
        img_str = re.search(r'base64,(.*)', data['image']).group(1)
    except (AttributeError, KeyError):
        return jsonify({"error": "Invalid image format or missing image data"}), 400

    nparr = np.frombuffer(base64.b64decode(img_str), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({"error": "Could not decode image"}), 400

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    faces = detector(gray)
    message = "Wajah tidak terdeteksi."
    blink_count = 0
    blink_rate = 0.0

    if len(faces) > 0:
        face = faces[0]
        landmarks = predictor(gray, face)

        left_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(36, 42)])
        right_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(42, 48)])

        ear = (eye_aspect_ratio(left_eye) + eye_aspect_ratio(right_eye)) / 2.0

        if ear < ear_threshold and not EYE_CLOSED:
            EYE_CLOSED = True
        elif ear >= ear_threshold and EYE_CLOSED:
            TOTAL_BLINKS += 1
            LAST_BLINK_TIME = time.time()
            EYE_CLOSED = False
            BLINK_TIMESTAMPS.append(LAST_BLINK_TIME)

        now = time.time()

        window_seconds = 60
        while BLINK_TIMESTAMPS and now - BLINK_TIMESTAMPS[0] > window_seconds:
            BLINK_TIMESTAMPS.popleft()

        blink_count = len(BLINK_TIMESTAMPS)

        if blink_count > 0 and BLINK_TIMESTAMPS:
            actual_window = min(window_seconds, now - BLINK_TIMESTAMPS[0])
            if actual_window < 1:
                actual_window = 1.0
            blink_rate = round((blink_count / actual_window) * 60.0, 2)
        else:
            elapsed_time = now - START_TIME if START_TIME else 0
            if elapsed_time >= 1:
                blink_rate = round((TOTAL_BLINKS / elapsed_time) * 60.0, 2)
            else:
                blink_rate = 0.0

        time_since_last_blink = now - LAST_BLINK_TIME

        if time_since_last_blink > stare_time_limit:
            message = f"⚠️ Anda sudah {int(time_since_last_blink)} detik tidak berkedip! Kedip sekarang! (Mode: {detection_mode.upper()})"
        elif blink_rate < warning_blink_rate:
            message = f"⚠️ Laju kedipan terlalu rendah ({blink_rate}/menit). Tingkatkan kedipan Anda! (Mode: {detection_mode.upper()})"
        else:
            message = f"✅ Deteksi berjalan normal. Laju kedipan: {blink_rate}/menit (Mode: {detection_mode.upper()})"

        return jsonify({
            "message": message,
            "total_blinks": TOTAL_BLINKS,
            "blink_count": blink_count,
            "blink_rate": blink_rate
        })

    return jsonify({
        "message": "⚠️ Wajah tidak terdeteksi. Silakan posisikan ulang kamera.",
        "total_blinks": TOTAL_BLINKS,
        "blink_count": blink_count,
        "blink_rate": 0
    })

@app.route('/devices', methods=['GET'])
def get_devices():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"error": "User ID required"}), 400
    
    try:
        # Ambil semua device milik user
        response = supabase.table("devices").select("*").eq("user_id", user_id).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/devices', methods=['POST'])
def register_device():
    data = request.get_json()
    user_id = data.get('user_id')
    device_name = data.get('device_name')

    if not user_id or not device_name:
        return jsonify({"error": "Data incomplete"}), 400

    try:
        new_device = {
            "user_id": user_id,
            "device_name": device_name,
            "is_active": True,
            "created_at": datetime.now(UTC).isoformat(),
            "updated_date": datetime.now(UTC).isoformat()
        }
        response = supabase.table("devices").insert(new_device).execute()
        return jsonify(response.data[0])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/stop_detection', methods=['POST'])
def stop_detection():
    global TOTAL_BLINKS, START_TIME, BLINK_TIMESTAMPS, EYE_CLOSED, LAST_BLINK_TIME

    data = request.get_json()

    current_user_id = data.get('user_id')
    current_device_id = data.get('device_id')
    current_detection_mode = data.get('detection_mode', 'focus')

    if not current_user_id:
        TOTAL_BLINKS = 0
        START_TIME = None
        BLINK_TIMESTAMPS.clear()
        EYE_CLOSED = False
        return jsonify({"message": "Sesi selesai, namun data tidak disimpan. User ID hilang."}), 400

    frontend_start_time = data.get('start_time')
    frontend_end_time = data.get('end_time')
    duration_sec = 0
    blink_per_minute = 0.0

    try:
        if frontend_start_time and frontend_end_time:
            start_dt = datetime.fromisoformat(frontend_start_time.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(frontend_end_time.replace('Z', '+00:00'))
            duration_sec = int((end_dt - start_dt).total_seconds())
        elif START_TIME:
            duration_sec = int(time.time() - START_TIME)
        else:
            duration_sec = 0
    except Exception:
        duration_sec = int(time.time() - (START_TIME or time.time()))

    blink_per_minute = round((TOTAL_BLINKS / (duration_sec / 60)), 2) if duration_sec > 1 else 0.0

    warning_limit = 8 if current_detection_mode == 'strict' else 10
    warning_triggered = TOTAL_BLINKS == 0 or blink_per_minute < warning_limit

    record = {
        "blink_count": TOTAL_BLINKS,
        "stare_duration_sec": duration_sec,
        "blink_per_minute": int(blink_per_minute),
        "warning_triggered": warning_triggered,
        "note": f"Mode: {current_detection_mode.upper()}",
        "captured_at": datetime.now(UTC).isoformat(),
        "user_id": current_user_id,
        "device_id": current_device_id,
        "detection_mode": current_detection_mode,
        "created_at": datetime.now(UTC).isoformat()
    }

    if duration_sec > 1 and TOTAL_BLINKS >= 0:
        try:
            supabase.table("blink_history").insert(record).execute()
        except Exception as e:
            TOTAL_BLINKS = 0
            START_TIME = None
            BLINK_TIMESTAMPS.clear()
            EYE_CLOSED = False
            LAST_BLINK_TIME = time.time()
            return jsonify({"error": f"Gagal menyimpan data ke Supabase: {str(e)}"}), 500
        
    if current_device_id:
        supabase.table("devices").update({"last_seen_at": datetime.now(UTC).isoformat()}).eq("id", current_device_id).execute()

    TOTAL_BLINKS = 0
    START_TIME = None
    BLINK_TIMESTAMPS.clear()
    EYE_CLOSED = False
    LAST_BLINK_TIME = time.time()

    return jsonify({
        "message": "Deteksi dihentikan. Data sesi berhasil disimpan.",
        "total_blinks": record.get("blink_count", 0),
        "duration": duration_sec,
        "blink_per_minute": record.get("blink_per_minute", 0)
    })


if __name__ == '__main__':
    app.run(debug=True)
