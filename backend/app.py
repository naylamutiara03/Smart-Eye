from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import re
import time
import os
import mediapipe as mp  # Import MediaPipe
from datetime import datetime, timezone
from supabase_client import supabase
from collections import deque

try:
    from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
    JWT_AVAILABLE = True
except Exception:
    JWT_AVAILABLE = False

    def jwt_required(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def get_jwt_identity():
        return None


app = Flask(__name__)
CORS(app)

if JWT_AVAILABLE:
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
    jwt = JWTManager(app)

# --- Inisialisasi MediaPipe Face Mesh ---
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,  # Penting untuk akurasi iris/mata
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Indeks Landmark Mata untuk MediaPipe (Mengikuti pola EAR)
# Left Eye (sesuai urutan dlib: P1, P2, P3, P4, P5, P6)
LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
# Right Eye
RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]

# Variabel Global Deteksi
BASE_EAR_THRESHOLD = 0.20
TOTAL_BLINKS = 0
LAST_BLINK_TIME = time.time()
START_TIME = None
BLINK_TIMESTAMPS = deque()
EYE_CLOSED = False

STREAM_FRESH_SECONDS = 5
# Stream Storage (Mapping Per hardware_id)
LATEST_STREAM_BY_HW = {} 

# Backward compatible 
LATEST_STREAM_DATA = {
    "image": None,
    "blink_count": 0,
    "blink_rate": 0,
    "message": "Menunggu kamera...",
    "hardware_id": None,
    "last_update": 0
}

# Camera Status + Session State
camera_status = {}

SESSION = {
    "active": False,
    "user_id": None,
    "device_id": None,
    "hardware_id": None,
    "mode": "focus",
    "started_at": None
}


def eye_aspect_ratio(eye):
    # eye adalah numpy array koordinat (x, y)
    A = np.linalg.norm(eye[1] - eye[5])
    B = np.linalg.norm(eye[2] - eye[4])
    C = np.linalg.norm(eye[0] - eye[3])
    return (A + B) / (2.0 * C)


def reset_detection_globals():
    global TOTAL_BLINKS, LAST_BLINK_TIME, START_TIME, EYE_CLOSED, BLINK_TIMESTAMPS
    TOTAL_BLINKS = 0
    START_TIME = None
    BLINK_TIMESTAMPS.clear()
    EYE_CLOSED = False
    LAST_BLINK_TIME = time.time()


def _is_fresh(last_update: float):
    return (time.time() - (last_update or 0)) <= STREAM_FRESH_SECONDS


def is_stream_online(hardware_id: str = None):
    if hardware_id:
        item = LATEST_STREAM_BY_HW.get(hardware_id)
        return bool(item) and _is_fresh(item.get("last_update"))
    return _is_fresh(LATEST_STREAM_DATA.get("last_update"))


def is_camera_active_for_hardware(hardware_id: str):
    if not hardware_id:
        return False
    return is_stream_online(hardware_id)


def set_latest_stream_for_hw(hardware_id: str, image: str, blink_count: int, blink_rate: float, message: str):
    global LATEST_STREAM_DATA, LATEST_STREAM_BY_HW

    payload = {
        "image": image,
        "blink_count": blink_count,
        "blink_rate": blink_rate,
        "message": message,
        "hardware_id": hardware_id,
        "last_update": time.time()
    }

    if hardware_id:
        LATEST_STREAM_BY_HW[hardware_id] = payload

    LATEST_STREAM_DATA = payload


def get_user_id_from_request_or_jwt():
    """
    Mengambil ID User dari Token JWT (jika ada) ATAU dari parameter request.
    """
    uid = get_jwt_identity()
    if uid:
        return uid

    uid_q = request.args.get("user_id")
    if uid_q:
        return uid_q

    data = request.get_json(silent=True) or {}
    return data.get("user_id")


def get_device_for_user(device_id_raw: str, current_user_id: str):
    try:
        device_id = int(device_id_raw)
    except Exception:
        return None, ("device_id tidak valid (harus angka/bigint).", 400)

    try:
        dev_res = (
            supabase.table("devices")
            .select("id,user_id,hardware_id,is_active")
            .eq("id", device_id)
            .limit(1)
            .execute()
        )
        if not dev_res.data:
            return None, ("Device tidak ditemukan.", 404)

        device = dev_res.data[0]
        if device.get("user_id") != current_user_id:
            return None, ("Forbidden: device bukan milik user ini.", 403)

        return device, None
    except Exception as e:
        return None, (f"Gagal query device: {str(e)}", 500)


@app.route("/")
def api_home():
    return jsonify({"message": "Smart-Eye Blink Detection API (MediaPipe) is running!"})


@app.route("/history", methods=["GET"])
def get_history():
    user_id = request.args.get("user_id")
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


@app.route("/api/start_detection", methods=["POST"])
@jwt_required(optional=True)  # Diubah ke optional agar support fallback user_id
def start_detection():
    global SESSION, START_TIME, LAST_BLINK_TIME, TOTAL_BLINKS, EYE_CLOSED, BLINK_TIMESTAMPS

    current_user_id = get_user_id_from_request_or_jwt()
    data = request.get_json() or {}
    device_id = data.get("device_id")
    detection_mode = data.get("mode", "focus")

    if not current_user_id:
        return jsonify({"message": "User tidak terautentikasi (user_id/JWT missing)."}), 401
    if not device_id:
        return jsonify({"message": "device_id wajib diisi."}), 400

    device, err = get_device_for_user(device_id, current_user_id)
    if err:
        msg, code = err
        return jsonify({"message": msg}), code

    if device.get("is_active") is False:
        return jsonify({"message": "Device nonaktif. Aktifkan device terlebih dahulu."}), 400

    hardware_id = device.get("hardware_id")

    if not is_camera_active_for_hardware(hardware_id):
        camera_status[hardware_id] = {"status": "inactive", "last_update": time.time()}
        return jsonify({"message": "Kamera tidak aktif atau tidak ditemukan."}), 400

    SESSION = {
        "active": True,
        "user_id": current_user_id,
        "device_id": int(device_id),
        "hardware_id": hardware_id,
        "mode": "strict" if detection_mode == "strict" else "focus",
        "started_at": datetime.now(timezone.utc).isoformat()
    }

    TOTAL_BLINKS = 0
    START_TIME = time.time()
    LAST_BLINK_TIME = time.time()
    BLINK_TIMESTAMPS.clear()
    EYE_CLOSED = False

    return jsonify({"message": "Deteksi dimulai!", "session": SESSION}), 200


@app.route("/api/camera_status/<string:device_id>", methods=["GET"])
@jwt_required(optional=True) # Diubah ke optional
def get_camera_status(device_id):
    current_user_id = get_user_id_from_request_or_jwt()
    if not current_user_id:
        return jsonify({"message": "User tidak terautentikasi (user_id/JWT missing)."}), 401

    device, err = get_device_for_user(device_id, current_user_id)
    if err:
        msg, code = err
        return jsonify({"message": msg}), code

    hardware_id = device.get("hardware_id")
    active = is_camera_active_for_hardware(hardware_id)
    status = "active" if active else "inactive"

    camera_status[hardware_id] = {"status": status, "last_update": time.time()}

    item = LATEST_STREAM_BY_HW.get(hardware_id) or {}
    return jsonify({
        "device_id": device.get("id"),
        "hardware_id": hardware_id,
        "status": status,
        "stream_online": is_stream_online(hardware_id),
        "last_stream_update": item.get("last_update", 0)
    }), 200


@app.route("/api/devices", methods=["GET"])
@jwt_required(optional=True)  # PERBAIKAN: Optional=True agar request dari History.js (tanpa token) bisa masuk
def get_user_devices():
    current_user_id = get_user_id_from_request_or_jwt()
    if not current_user_id:
        return jsonify({"message": "User tidak terautentikasi (user_id/JWT missing)."}), 401

    try:
        res = (
            supabase.table("devices")
            .select("*")
            .eq("user_id", current_user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return jsonify(res.data or []), 200
    except Exception as e:
        return jsonify({"message": f"Gagal ambil devices: {str(e)}"}), 500


@app.route("/api/history/<string:device_id>", methods=["GET"])
@jwt_required(optional=True) # PERBAIKAN: Optional=True agar request history per device juga berjalan
def get_history_by_device(device_id):
    current_user_id = get_user_id_from_request_or_jwt()
    if not current_user_id:
        return jsonify({"message": "User tidak terautentikasi (user_id/JWT missing)."}), 401

    device, err = get_device_for_user(device_id, current_user_id)
    if err:
        msg, code = err
        return jsonify({"message": msg}), code

    try:
        hist = (
            supabase.table("blink_history")
            .select("*")
            .eq("user_id", current_user_id)
            .eq("device_id", device.get("id"))
            .order("captured_at", desc=True)
            .limit(50)
            .execute()
        )
        return jsonify(hist.data or []), 200
    except Exception as e:
        return jsonify({"message": f"Gagal ambil history: {str(e)}"}), 500


@app.route("/api/latest_stream/<string:device_id>", methods=["GET"])
@jwt_required(optional=True) # Diubah ke optional
def api_latest_stream(device_id):
    current_user_id = get_user_id_from_request_or_jwt()
    if not current_user_id:
        return jsonify({"message": "User tidak terautentikasi (user_id/JWT missing)."}), 401

    device, err = get_device_for_user(device_id, current_user_id)
    if err:
        msg, code = err
        return jsonify({"message": msg}), code

    hardware_id = device.get("hardware_id")
    item = LATEST_STREAM_BY_HW.get(hardware_id)

    if not item:
        return jsonify({"message": "Tidak ada data stream terbaru untuk perangkat ini."}), 404

    if not _is_fresh(item.get("last_update")):
        return jsonify({"message": "Stream untuk device ini sudah tidak fresh / kamera offline."}), 404

    return jsonify({
        "status": "online",
        "device_id": device.get("id"),
        "hardware_id": hardware_id,
        "data": item
    }), 200


@app.route("/process_frame", methods=["POST"])
def process_frame():
    global TOTAL_BLINKS, LAST_BLINK_TIME, START_TIME, EYE_CLOSED, BLINK_TIMESTAMPS
    global SESSION, camera_status

    data = request.get_json() or {}
    hardware_id = data.get("hardware_id")

    # enforce session
    if SESSION.get("active"):
        session_hw = SESSION.get("hardware_id")
        if session_hw and hardware_id and (hardware_id != session_hw):
            return jsonify({"error": "Device mismatch: frame bukan dari device yang sedang aktif."}), 403

    detection_mode = SESSION.get("mode") if SESSION.get("active") else data.get("mode", "focus")

    if detection_mode == "strict":
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
        img_str = re.search(r"base64,(.*)", data["image"]).group(1)
    except (AttributeError, KeyError):
        return jsonify({"error": "Invalid image format or missing image data"}), 400

    nparr = np.frombuffer(base64.b64decode(img_str), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({"error": "Could not decode image"}), 400

    # --- MEDIAPIPE LOGIC START ---
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img_h, img_w, _ = frame.shape
    
    results = face_mesh.process(rgb_frame)

    blink_count = 0
    blink_rate = 0.0
    
    if results.multi_face_landmarks:
        # Ambil wajah pertama
        face_landmarks = results.multi_face_landmarks[0].landmark

        # Helper untuk konversi normalized landmark ke pixel coordinates
        def get_eye_coords(indices, landmarks):
            coords = []
            for i in indices:
                pt = landmarks[i]
                x = int(pt.x * img_w)
                y = int(pt.y * img_h)
                coords.append((x, y))
            return np.array(coords)

        # Ambil koordinat mata kiri dan kanan
        left_eye = get_eye_coords(LEFT_EYE_INDICES, face_landmarks)
        right_eye = get_eye_coords(RIGHT_EYE_INDICES, face_landmarks)

        # Hitung EAR
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
            blink_rate = round((TOTAL_BLINKS / elapsed_time) * 60.0, 2) if elapsed_time >= 1 else 0.0

        time_since_last_blink = now - LAST_BLINK_TIME

        if time_since_last_blink > stare_time_limit:
            message = f"⚠️ Anda sudah {int(time_since_last_blink)} detik tidak berkedip! Kedip sekarang! (Mode: {detection_mode.upper()})"
        elif blink_rate < warning_blink_rate:
            message = f"⚠️ Laju kedipan terlalu rendah ({blink_rate}/menit). Tingkatkan kedipan Anda! (Mode: {detection_mode.upper()})"
        else:
            message = f"✅ Deteksi berjalan normal. Laju kedipan: {blink_rate}/menit (Mode: {detection_mode.upper()})"

        # Menyimpan stream per hardware_id
        set_latest_stream_for_hw(
            hardware_id=hardware_id,
            image=data["image"],
            blink_count=blink_count,
            blink_rate=blink_rate,
            message=message
        )

        if hardware_id:
            camera_status[hardware_id] = {"status": "active", "last_update": time.time()}

        return jsonify({
            "message": message,
            "total_blinks": TOTAL_BLINKS,
            "blink_count": blink_count,
            "blink_rate": blink_rate
        })
    # --- MEDIAPIPE LOGIC END ---

    # Jika tidak ada wajah terdeteksi
    message = "⚠️ Wajah tidak terdeteksi. Silakan posisikan ulang kamera."
    set_latest_stream_for_hw(
        hardware_id=hardware_id,
        image=data.get("image"),
        blink_count=0,
        blink_rate=0.0,
        message=message
    )

    if hardware_id:
        camera_status[hardware_id] = {"status": "active", "last_update": time.time()}

    return jsonify({
        "message": message,
        "total_blinks": TOTAL_BLINKS,
        "blink_count": 0,
        "blink_rate": 0
    })


@app.route("/stream/latest", methods=["GET"])
def get_latest_stream():
    if not is_stream_online():
        return jsonify({"status": "offline", "message": "Kamera tidak aktif/terputus."})
    return jsonify({"status": "online", "data": LATEST_STREAM_DATA})


@app.route("/devices", methods=["GET"])
def get_devices():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "User ID required"}), 400

    try:
        response = supabase.table("devices").select("*").eq("user_id", user_id).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/devices", methods=["POST"])
def register_device():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    device_name = data.get("device_name")
    hardware_id = data.get("hardware_id")

    if not user_id or not device_name or not hardware_id:
        return jsonify({"error": "Data incomplete (missing user_id, device_name, or hardware_id)"}), 400

    try:
        new_device = {
            "user_id": user_id,
            "device_name": device_name,
            "is_active": True,
            "hardware_id": hardware_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_date": datetime.now(timezone.utc).isoformat()
        }
        response = supabase.table("devices").insert(new_device).execute()
        return jsonify(response.data[0])
    except Exception as e:
        print(f"Error registering device: {e}")
        if "unique constraint" in str(e).lower():
            return jsonify({"error": "Perangkat ini sudah didaftarkan."}), 409
        return jsonify({"error": str(e)}), 500


@app.route("/stop_detection", methods=["POST"])
def stop_detection():
    global SESSION

    data = request.get_json() or {}

    current_user_id = data.get("user_id")
    current_device_id = data.get("device_id")
    current_detection_mode = data.get("detection_mode", "focus")

    client_total_blinks = data.get("total_blinks")
    client_blink_rate = data.get("blink_rate")

    if not current_user_id:
        reset_detection_globals()
        SESSION = {"active": False, "user_id": None, "device_id": None, "hardware_id": None, "mode": "focus", "started_at": None}
        return jsonify({"message": "Sesi selesai, namun data tidak disimpan. User ID hilang."}), 400

    frontend_start_time = data.get("start_time")
    frontend_end_time = data.get("end_time")

    duration_sec = 0
    blink_per_minute = client_blink_rate if client_blink_rate is not None else 0.0

    try:
        if frontend_start_time and frontend_end_time:
            start_dt = datetime.fromisoformat(frontend_start_time.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(frontend_end_time.replace("Z", "+00:00"))
            duration_sec = int((end_dt - start_dt).total_seconds())
    except Exception:
        duration_sec = 0

    actual_total_blinks = client_total_blinks if client_total_blinks is not None else TOTAL_BLINKS

    if duration_sec > 1 and actual_total_blinks > 0 and client_blink_rate is None:
        blink_per_minute = round((actual_total_blinks / (duration_sec / 60)), 2)

    warning_limit = 8 if current_detection_mode == "strict" else 10
    warning_triggered = actual_total_blinks == 0 or blink_per_minute < warning_limit

    record = {
        "blink_count": actual_total_blinks,
        "stare_duration_sec": duration_sec,
        "blink_per_minute": int(blink_per_minute),
        "warning_triggered": warning_triggered,
        "note": f"Mode: {current_detection_mode.upper()}",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user_id,
        "device_id": current_device_id,
        "detection_mode": current_detection_mode,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    if duration_sec > 1 and actual_total_blinks >= 0:
        try:
            supabase.table("blink_history").insert(record).execute()
        except Exception as e:
            print(f"SUPABASE SAVE ERROR in stop_detection: {e}")
            reset_detection_globals()
            SESSION = {"active": False, "user_id": None, "device_id": None, "hardware_id": None, "mode": "focus", "started_at": None}
            return jsonify({"error": f"Gagal menyimpan data ke Supabase: {str(e)}"}), 500

    if current_device_id:
        supabase.table("devices").update({"last_seen_at": datetime.now(timezone.utc).isoformat()}).eq("id", current_device_id).execute()

    reset_detection_globals()
    SESSION = {"active": False, "user_id": None, "device_id": None, "hardware_id": None, "mode": "focus", "started_at": None}

    return jsonify({
        "message": "Deteksi dihentikan. Data sesi berhasil disimpan.",
        "total_blinks": record.get("blink_count", 0),
        "duration": duration_sec,
        "blink_per_minute": record.get("blink_per_minute", 0)
    })


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)