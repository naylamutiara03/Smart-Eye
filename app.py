from flask import Flask, render_template, request, jsonify, redirect, url_for
import cv2, dlib, numpy as np, base64, re, time, datetime
from supabase_client import supabase  # import supabase client
from collections import deque

app = Flask(__name__)

detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("shape_predictor_68_face_landmarks.dat")

EAR_THRESHOLD = 0.20
CLOSED_FRAMES = 2
NO_BLINK_LIMIT = 5

COUNTER = 0
TOTAL_BLINKS = 0
LAST_BLINK_TIME = time.time()
START_TIME = None

history_records = []  # simpan history di memori

def eye_aspect_ratio(eye):
    A = np.linalg.norm(eye[1] - eye[5])
    B = np.linalg.norm(eye[2] - eye[4])
    C = np.linalg.norm(eye[0] - eye[3])
    return (A + B) / (2.0 * C)

@app.route('/')
def home():
    return render_template("index.html", title="Home")

@app.route('/detect')
def detect():
    return render_template("detect.html", title="Deteksi")

@app.route('/history')
def history():
    # ambil data dari supabase
    response = supabase.table("blink_history").select("*").order("time", desc=True).execute()
    records = response.data
    return render_template("history.html", records=records, title="History")

# simpan timestamp semua kedipan (window 1 menit)
BLINK_TIMESTAMPS = deque()

# flag mata
EYE_CLOSED = False  

@app.route('/process_frame', methods=['POST'])
def process_frame():
    global TOTAL_BLINKS, LAST_BLINK_TIME, START_TIME, EYE_CLOSED, BLINK_TIMESTAMPS

    if START_TIME is None:
        START_TIME = time.time()

    data = request.get_json()
    img_str = re.search(r'base64,(.*)', data['image']).group(1)
    nparr = np.frombuffer(base64.b64decode(img_str), np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    faces = detector(gray)
    message = "Mata terbuka"

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

    # hapus kedipan yang lebih dari 60 detik
    now = time.time()
    while BLINK_TIMESTAMPS and now - BLINK_TIMESTAMPS[0] > 60:
        BLINK_TIMESTAMPS.popleft()

    blink_rate = len(BLINK_TIMESTAMPS)  # kedipan dalam 1 menit

    if now - LAST_BLINK_TIME > 20:
        message = "⚠️ Anda terlalu lama menatap layar. Lakukan exercise mata!"
    elif blink_rate > 30:  # misalnya >30 kedipan per menit dianggap tidak normal
        message = "⚠️ Kedipan terlalu sering! Istirahatkan mata Anda."
    else:
        message = f"Kedipan total: {TOTAL_BLINKS} | Blink rate: {blink_rate}/menit"

    return jsonify({
        "message": message,
        "total_blinks": TOTAL_BLINKS,
        "blink_rate": blink_rate
    })


@app.route('/stop_detection')
def stop_detection():
    global TOTAL_BLINKS, START_TIME, COUNTER
    duration = int(time.time() - START_TIME) if START_TIME else 0

    # data record
    record = {
        "time": datetime.datetime.now().isoformat(),
        "blinks": TOTAL_BLINKS,
        "duration": duration
    }

    # simpan ke supabase
    supabase.table("blink_history").insert(record).execute()

    data = {"total_blinks": TOTAL_BLINKS, "duration": duration}

    # reset state
    TOTAL_BLINKS = 0
    START_TIME = None
    COUNTER = 0

    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)

