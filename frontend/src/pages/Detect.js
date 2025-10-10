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
            if (!document.hidden) return; 

            new Notification("EyeCare Alert", {
                body: text,
                icon: "https://cdn-icons-png.flaticon.com/512/709/709496.png"
            });
        }
    };
    
    useEffect(() => {
        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        
        return () => {
            stopDetection(false);
        };
    }, []);

    const captureFrame = () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return null;

        const canvas = document.createElement("canvas");
        const width = 320; 
        const height = (videoRef.current.videoHeight / videoRef.current.videoWidth) * width;

        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(videoRef.current, 0, 0, width, height);
        return canvas.toDataURL("image/jpeg", 0.7); 
    };

    const startDetection = async () => {
        try {
            // PERBAIKAN: Cek jika videoRef belum terisi
            if (!videoRef.current) {
                console.error("Video element reference is null.");
                // Mengganti alert dengan setWarning
                setWarning("Tidak bisa memulai deteksi. Elemen kamera belum siap.");
                return; 
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setIsDetecting(true);

            intervalRef.current = setInterval(async () => {
                const frame = captureFrame();
                if (!frame) return; 
                
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
            }, 100); 

        } catch (err) {
            // Mengganti alert dengan setWarning
            setWarning("❌ Tidak bisa mengakses kamera: " + err.message);
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
                console.log(`Deteksi dihentikan. Total Kedipan: ${res.data.total_blinks} (durasi ${res.data.duration} detik)`);
                setWarning(`✅ Sesi selesai! Total Kedipan: ${res.data.total_blinks} (durasi ${res.data.duration} detik)`);
            } catch (err) {
                console.error("Error stopping detection:", err);
            }
        }
    };

    return (
        <div className="text-center p-4"> 
            <h2 className="mb-4 text-2xl font-bold text-gray-800">Deteksi Kedipan Mata</h2>
            <p className="mb-4 text-gray-600">Klik tombol <b>Mulai Deteksi</b> untuk menyalakan kamera. Data dikirim ke Flask API.</p>

            <div className="mx-auto my-3"
                 style={{ 
                     width: '90%', 
                     maxWidth: '480px', 
                     aspectRatio: '4 / 3',
                     borderRadius: '12px', 
                     overflow: 'hidden' 
                 }}>
                {/* Elemen <video> selalu ada di DOM, tetapi disembunyikan jika tidak digunakan */}
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted={true} 
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                        display: isDetecting ? 'block' : 'none' 
                    }} 
                />
                
                {/* Tampilkan placeholder jika kamera dinonaktifkan */}
                {/* PERBAIKAN: Pastikan div placeholder memiliki tinggi dan lebar penuh untuk memusatkan teks */}
                {!isDetecting && (
                    <div className="w-full h-full bg-gray-200 flex justify-center items-center rounded-xl border border-dashed border-gray-400"
                         style={{ 
                             // Styling ini sudah mencakup centering karena adanya flex dan justify/align-center dari Tailwind
                             width: '100%', 
                             height: '100%',
                         }}>
                        <p className=" text-gray-500">Kamera dinonaktifkan</p>
                    </div>
                )}
            </div>
            
            <div className="mt-6">
                {!isDetecting ? (
                    <button 
                        onClick={startDetection} 
                        className="px-6 py-3 bg-blue text-black font-semibold rounded shadow-xl hover:bg-blue-700 transition duration-300 transform hover:scale-105">
                        Mulai Deteksi
                    </button>
                ) : (
                    <button 
                        onClick={() => stopDetection(true)} 
                        className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-xl hover:bg-red-700 transition duration-300 transform hover:scale-105">
                        Berhenti Deteksi
                    </button>
                )}
            </div>

            {isDetecting && (
                <div className="mt-6 p-4 bg-white shadow-lg rounded-xl mx-auto max-w-sm">
                    <p className="text-xl font-bold text-blue-600">
                        Total Kedipan: **{stats.total_blinks}**
                    </p>
                    <p className="text-lg text-gray-700">
                        Rate: **{stats.blink_rate}**/menit
                    </p>
                </div>
            )}
            
            {warning && (
                <div className={`mt-4 p-3 font-semibold rounded-lg mx-auto max-w-md ${warning.startsWith('⚠️') ? 'bg-yellow-100 text-yellow-800' : warning.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {warning}
                </div>
            )}
        </div>
    );
}

export default Detect;
