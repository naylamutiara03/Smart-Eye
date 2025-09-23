import dlib
import cv2
import numpy as np
import time

# Inisialisasi detektor wajah dan predictor dlib
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("shape_predictor_68_face_landmarks.dat")

# Inisialisasi kamera
cap = cv2.VideoCapture(0)

# Threshold dan counter untuk kedipan mata
EAR_THRESHOLD = 0.25
CONSEC_FRAMES = 30
COUNTER = 0
last_blink_time = 0

# Fungsi untuk menghitung Eye Aspect Ratio (EAR)
def eye_aspect_ratio(eye):
    A = np.linalg.norm(eye[1] - eye[5])
    B = np.linalg.norm(eye[2] - eye[4])
    C = np.linalg.norm(eye[0] - eye[3])
    ear = (A + B) / (2.0 * C)
    return ear

while True:
    ret, frame = cap.read()
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Deteksi wajah
    faces = detector(gray)
    for face in faces:
        landmarks = predictor(gray, face)

        # Ambil koordinat mata kiri dan kanan
        left_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(36, 42)])
        right_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(42, 48)])

        # Hitung EAR untuk kedua mata
        left_ear = eye_aspect_ratio(left_eye)
        right_ear = eye_aspect_ratio(right_eye)

        ear = (left_ear + right_ear) / 2.0

        # Jika EAR di bawah threshold, berarti mata tertutup
        if ear < EAR_THRESHOLD:
            COUNTER += 1
            if COUNTER >= CONSEC_FRAMES:
                print("Mata terdeteksi tertutup untuk waktu yang lama, istirahatkan mata!")
                last_blink_time = time.time()  # Setel waktu terakhir kedipan
        else:
            COUNTER = 0

    cv2.imshow("Eye Blink Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
