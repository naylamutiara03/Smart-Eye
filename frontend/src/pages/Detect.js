// frontend/src/pages/Detect.js
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:5000';

function Detect() {
    const [isDetecting, setIsDetecting] = useState(false);
    const [stats, setStats] = useState({ total_blinks: 0, blink_rate: 0 });
    const [warning, setWarning] = useState('');
    
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);

    // Audio untuk notifikasi
    const beep = useRef(new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg"));

    // Fungsi untuk menampilkan notifikasi desktop
    const showNotification = (text) => {
        if (Notification.permission === "granted") {
            new Notification("EyeCare Alert", {
                body: text,
                icon: "https://cdn-icons-png.flaticon.com/512/709/709496.png"
            });
        }
    };
    
    useEffect(() => {
        // Minta izin notifikasi saat komponen dimuat
        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        
        // Cleanup function untuk menghentikan kamera saat komponen unmount
        return () => {
            stopDetection(false); // false agar tidak mengirim request ke server
        };
    }, []);

    const captureFrame = () => {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
        return canvas.toDataURL("image/jpeg");
    };

    const startDetection = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setIsDetecting(true);

            intervalRef.current = setInterval(async () => {
                const frame = captureFrame();
                try {
                    const res = await axios.post(`${API_URL}/process_frame`, { image: frame });
                    setStats({
                        total_blinks: res.data.total_blinks,
                        blink_rate: res.data.blink_rate
                    });
                    
                    if (res.data.message.includes("⚠️")) {
                        setWarning(res.data.message);
                        showNotification(res.data.message);
                        beep.current.play();
                    } else {
                        setWarning('');
                    }
                } catch (err) {
                    console.error("Error processing frame:", err);
                }
            }, 1000);

        } catch (err) {
            alert("Tidak bisa mengakses kamera: " + err);
        }
    };

    const stopDetection = async (saveRecord = true) => {
        clearInterval(intervalRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setIsDetecting(false);
        setStats({ total_blinks: 0, blink_rate: 0 });
        setWarning('');

        if (saveRecord) {
            try {
                const res = await axios.post(`${API_URL}/stop_detection`);
                alert(`Deteksi dihentikan. Total Kedipan: ${res.data.total_blinks} (durasi ${res.data.duration} detik)`);
            } catch (err) {
                console.error("Error stopping detection:", err);
            }
        }
    };

    return (
        <div>
            <h2 className="mb-4">Deteksi Kedipan Mata</h2>
            <p>Klik tombol <b>Mulai Deteksi</b> untuk menyalakan kamera.</p>

            <div className="mx-auto bg-dark my-3"
                 style={{ width: '480px', height: '360px', borderRadius: '12px', display: isDetecting ? 'block' : 'none' }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
            </div>

            <div className="mt-3">
                {!isDetecting ? (
                    <button onClick={startDetection} className="btn btn-primary">Mulai Deteksi</button>
                ) : (
                    <button onClick={() => stopDetection(true)} className="btn btn-danger">Berhenti Deteksi</button>
                )}
            </div>

            {isDetecting && (
                <>
                    <p className="mt-3 fw-bold text-primary">
                        Total Kedipan: {stats.total_blinks} | Rate: {stats.blink_rate}/menit
                    </p>
                    <p className="mt-2 fw-bold text-danger">{warning}</p>
                </>
            )}
        </div>
    );
}

export default Detect;