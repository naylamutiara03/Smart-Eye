import dlib
import cv2
import numpy as np
import time
import base64
from collections import deque

LATEST_STREAM_DATA = {}

# Dlib init 
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("shape_predictor_68_face_landmarks.dat")

# Parameter deteksi
EAR_THRESHOLD = 0.25
CONSEC_FRAMES = 30
COUNTER = 0

# Untuk blink rate (per menit) pakai window 60 detik
BLINK_TIMESTAMPS = deque()
EYE_CLOSED = False
LAST_BLINK_TIME = time.time()
START_TIME = time.time()


def eye_aspect_ratio(eye):
    A = np.linalg.norm(eye[1] - eye[5])
    B = np.linalg.norm(eye[2] - eye[4])
    C = np.linalg.norm(eye[0] - eye[3])
    return (A + B) / (2.0 * C)


def frame_to_data_uri(frame, width=480, height=360, jpg_quality=80):
    """Encode frame (BGR) → data:image/jpeg;base64,..."""
    frame = cv2.resize(frame, (width, height))
    ok, buffer = cv2.imencode(
        ".jpg",
        frame,
        [int(cv2.IMWRITE_JPEG_QUALITY), int(jpg_quality)]
    )
    if not ok:
        return None

    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def process_camera_stream(device_id: str, frame_bgr, blink_rate: float, blink_count: int, message: str):
    """
    Fungsi ini dipanggil setiap ada frame baru.
    Ia menyimpan data stream terbaru ke mapping LATEST_STREAM_DATA[device_id].
    """
    global LATEST_STREAM_DATA

    data_uri = frame_to_data_uri(frame_bgr)
    if data_uri is None:
        # Kalau encode gagal, tetap update timestamp + message
        LATEST_STREAM_DATA[device_id] = {
            "stream_content": None,
            "timestamp": time.time(),
            "blink_rate": blink_rate,
            "blink_count": blink_count,
            "message": "[WARN] Gagal encode frame.",
        }
        return

    LATEST_STREAM_DATA[device_id] = {
        "stream_content": data_uri,
        "timestamp": time.time(),
        "blink_rate": blink_rate,
        "blink_count": blink_count,
        "message": message,
    }


def compute_blink_rate(now_ts: float):
    """
    Hitung blink per menit dari BLINK_TIMESTAMPS dengan window 60 detik.
    """
    window_seconds = 60

    # buang timestamp lama
    while BLINK_TIMESTAMPS and (now_ts - BLINK_TIMESTAMPS[0] > window_seconds):
        BLINK_TIMESTAMPS.popleft()

    blink_count = len(BLINK_TIMESTAMPS)

    if blink_count > 0:
        actual_window = min(window_seconds, now_ts - BLINK_TIMESTAMPS[0])
        if actual_window < 1:
            actual_window = 1.0
        blink_rate = round((blink_count / actual_window) * 60.0, 2)
    else:
        elapsed = now_ts - START_TIME
        blink_rate = 0.0 if elapsed < 1 else 0.0

    return blink_rate, blink_count


def run_local_camera(device_id="camera-0", camera_index=0):
    global COUNTER, EYE_CLOSED, LAST_BLINK_TIME, START_TIME

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        print(f"❌ Gagal membuka kamera index {camera_index}")
        return

    print("=" * 50)
    print("SMART-EYE (LOCAL CAMERA STREAM)")
    print(f"device_id   : {device_id}")
    print(f"camera_index: {camera_index}")
    print("Tekan 'q' untuk keluar")
    print("=" * 50)

    START_TIME = time.time()
    LAST_BLINK_TIME = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Gagal membaca kamera")
            break

        now = time.time()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        faces = detector(gray)
        message = "Wajah tidak terdeteksi."
        blink_rate = 0.0
        blink_count = 0

        if len(faces) > 0:
            face = faces[0]
            landmarks = predictor(gray, face)

            left_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(36, 42)])
            right_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(42, 48)])

            ear = (eye_aspect_ratio(left_eye) + eye_aspect_ratio(right_eye)) / 2.0

            # Deteksi blink berbasis state 
            if ear < EAR_THRESHOLD and not EYE_CLOSED:
                EYE_CLOSED = True

            elif ear >= EAR_THRESHOLD and EYE_CLOSED:
                EYE_CLOSED = False
                LAST_BLINK_TIME = now
                BLINK_TIMESTAMPS.append(now)

            # Hitung blink rate
            blink_rate, blink_count = compute_blink_rate(now)

            # Deteksi mata tertutup lama 
            if ear < EAR_THRESHOLD:
                COUNTER += 1
                if COUNTER >= CONSEC_FRAMES:
                    message = "⚠️ Mata tertutup terlalu lama, istirahatkan mata!"
            else:
                COUNTER = 0
                message = f"✅ Normal. Blink rate: {blink_rate}/menit"

        # Simpan stream ke mapping 
        process_camera_stream(
            device_id=device_id,
            frame_bgr=frame,
            blink_rate=blink_rate,
            blink_count=blink_count,
            message=message
        )

        # Debug: menampilkan frame lokal
        cv2.imshow("Eye Blink Detection (Local)", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    # Kalau mau pakai device_id lain, ganti di sini:
    run_local_camera(device_id="camera-0", camera_index=0)
