import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

// Konfigurasi API
const API_URL = 'http://127.0.0.1:5000';

// Ikon menggunakan inline SVG (lebih ringan dan mudah disesuaikan)
const PlayIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
);

const StopIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="5" width="14" height="14" rx="2" ry="2"></rect>
    </svg>
);

const CameraIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h.5a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h.5"></path>
        <path d="M18 10l-4 4-2-2"></path>
        <circle cx="10" cy="10" r="8"></circle>
    </svg>
);

const BlinksIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M8 12s2 1 4 1 4-1 4-1"></path>
        <line x1="12" y1="8" x2="12" y2="12"></line>
    </svg>
);

const RateIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
);


function Detect() {
    const [isDetecting, setIsDetecting] = useState(false);
    const [stats, setStats] = useState({ total_blinks: 0, blink_rate: 0 });
    const [warning, setWarning] = useState('');

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);

    // Audio untuk notifikasi
    // Pastikan URL ini dapat diakses atau ganti dengan base64 data jika ada masalah
    const beep = useRef(new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg"));

    // Fungsi untuk menampilkan notifikasi desktop
    const showNotification = (text) => {
        if (Notification.permission === "granted") {
            // Hanya tampilkan notifikasi jika tab tidak aktif/tersembunyi
            if (!document.hidden) return;

            new Notification("EyeCare Alert", {
                body: text,
                icon: "https://cdn-icons-png.flaticon.com/512/709/709496.png"
            });
        }
    };

    // Request permission on mount and cleanup on unmount
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
        // Gunakan lebar yang lebih kecil untuk transfer data yang cepat (misal 240px)
        const width = 240;
        const height = (videoRef.current.videoHeight / videoRef.current.videoWidth) * width;

        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(videoRef.current, 0, 0, width, height);
        // Kualitas JPEG yang lebih rendah (cepat)
        return canvas.toDataURL("image/jpeg", 0.6);
    };

    const startDetection = async () => {
        try {
            if (!videoRef.current) {
                console.error("Video element reference is null.");
                setWarning("Tidak bisa memulai deteksi. Elemen kamera belum siap.");
                return;
            }

            // Meminta akses ke kamera
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setIsDetecting(true);
            setWarning('');

            // Mulai interval pengiriman frame (100ms interval)
            intervalRef.current = setInterval(async () => {
                const frame = captureFrame();
                if (!frame) return;

                try {
                    // Coba 3x dengan backoff eksponensial
                    let res;
                    for (let i = 0; i < 3; i++) {
                        try {
                            res = await axios.post(`${API_URL}/process_frame`, { image: frame });
                            break; // Berhasil, keluar dari loop
                        } catch (err) {
                            if (i < 2) {
                                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 500)); // Backoff
                            } else {
                                throw err; // Gagal setelah semua percobaan
                            }
                        }
                    }

                    if (!res) return;

                    setStats({
                        total_blinks: res.data.total_blinks,
                        blink_rate: res.data.blink_rate
                    });

                    if (res.data.message.includes("⚠️")) {
                        setWarning(res.data.message);
                        showNotification(res.data.message);
                        beep.current.play().catch(e => console.log("Gagal memutar audio:", e.message));
                    } else if (res.data.message.includes("✅")) {
                        // Jangan overwrite warning sesi selesai
                    } else {
                        // Hapus warning jika sudah tidak ada peringatan aktif, 
                        // tetapi pertahankan pesan "sesi selesai" jika ada
                        if (!warning.startsWith('✅')) {
                            setWarning('');
                        }
                    }
                } catch (err) {
                    console.error("Error processing frame:", err);
                    setWarning("Gagal memproses frame atau koneksi terputus.");
                    // Stop detection automatically on persistent failure
                    stopDetection(false);
                }
            }, 100);

        } catch (err) {
            setWarning("❌ Tidak bisa mengakses kamera: " + err.message);
        }
    };

    const stopDetection = async (saveRecord = true) => {
        clearInterval(intervalRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsDetecting(false);
        setStats({ total_blinks: 0, blink_rate: 0 });

        if (saveRecord) {
            try {
                const res = await axios.post(`${API_URL}/stop_detection`);

                // Buat pesan sukses.
                const successMessage = `✅ Sesi selesai! Total Kedipan: ${res.data.total_blinks} (durasi ${res.data.duration} detik)`;

                // Tambahkan tombol "Lihat Riwayat" (a href="/history").
                // Styling CSS inline digunakan untuk memastikan tombol terlihat bagus.
                const historyButtonHtml = `
            <a href="/history" 
               style="
                   margin-left: 1rem; 
                   padding: 0.5rem 1rem; 
                   background-color: #10B981; /* Warna hijau keren */
                   color: white; 
                   border-radius: 0.5rem; 
                   text-decoration: none; 
                   font-weight: 600; 
                   display: inline-block;
                   transition: background-color 0.3s ease;
                   box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06);
               "
               onmouseover="this.style.backgroundColor='#059669';"
               onmouseout="this.style.backgroundColor='#10B981';"
            >
                Lihat Riwayat
            </a>
        `;

                console.log(`Deteksi dihentikan. Total Kedipan: ${res.data.total_blinks} (durasi ${res.data.duration} detik)`);

                // Gabungkan pesan sukses dengan tombol riwayat.
                // Catatan: Pastikan komponen yang menampilkan 'warning' menggunakan dangerouslySetInnerHTML 
                // agar tag <a> HTML ini dapat di-render dengan benar.
                setWarning(`${successMessage}. ${historyButtonHtml}`);

            } catch (err) {
                console.error("Error stopping detection:", err);
                setWarning(`Error saat menghentikan sesi: ${err.message}`);
            }
        } else {
            setWarning('');
        }
    };

    // --- Inline Styles (CSS Properties with Responsive Mindset) ---
    const primaryColor = '#3b82f6'; // blue-500 (Cleaner primary color)
    const secondaryBg = '#e0f2fe'; // blue-50 (Lighter background for cards)

    // Main Container (Flex for centering content)
    const mainContainerStyle = {
        fontFamily: 'Inter, sans-serif',
        minHeight: '100vh',
        backgroundColor: '#fffff', // bg-gray-50
        padding: '2rem 1rem',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
    };

    // Content Wrapper (Handles responsive layout)
    const contentWrapperStyle = {
        display: 'flex',
        flexDirection: window.innerWidth > 768 ? 'row' : 'column', // Desktop: row, Mobile: column (Tailwind: md:flex-row)
        gap: '1.5rem',
        maxWidth: '1000px', // max-w-5xl
        width: '100%',
    };

    // Card Base Style
    const cardBaseStyle = {
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '1rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        transition: 'box-shadow 0.3s ease',
    };

    // Left Panel (Video, Controls, Warning)
    const leftPanelStyle = {
        ...cardBaseStyle,
        flex: window.innerWidth > 768 ? '3' : '1', // 60% on desktop (3/5)
    };

    // Right Panel (Stats)
    const rightPanelStyle = {
        ...cardBaseStyle,
        flex: window.innerWidth > 768 ? '2' : '1', // 40% on desktop (2/5)
        backgroundColor: secondaryBg,
        display: 'flex',
        flexDirection: 'column',
    };

    // Stats Grid Container
    const statsGridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem',
        marginTop: '1rem',
    };

    // Individual Stat Item
    const statItemStyle = {
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        textAlign: 'center',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    };

    // Video/Placeholder Styling
    const videoStyle = {
        width: '100%',
        height: 'auto',
        aspectRatio: '4 / 3',
        objectFit: 'cover',
        transform: 'scaleX(-1)', // Flip horizontal
        borderRadius: '0.75rem',
        backgroundColor: '#374151', // bg-gray-700
    };

    const videoPlaceholderStyle = {
        ...videoStyle,
        aspectRatio: '4 / 3',
        border: '2px dashed #9ca3af',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        transform: 'none',
    };

    const buttonBaseStyle = {
        padding: '0.75rem 1.25rem',
        fontWeight: '600',
        borderRadius: '0.5rem',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: 'none',
        transition: 'background-color 0.3s, transform 0.1s, box-shadow 0.3s',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
    };

    const startButtonStyle = {
        ...buttonBaseStyle,
        backgroundColor: primaryColor,
        color: 'white',
    };

    const stopButtonStyle = {
        ...buttonBaseStyle,
        backgroundColor: '#ef4444', // red-500
        color: 'white',
    };


    return (
        <div style={mainContainerStyle}>
            {/* Wrapper Card & API Info */}
            <div className="flex flex-col items-center w-full">

                <h1 style={{ color: primaryColor, fontSize: '2.5rem', fontWeight: '800', marginBottom: '1.5rem' }}>
                    EyeCare Blink Detector
                </h1>

                {/* Main Responsive Content Area (Left and Right Panel) */}
                <div style={contentWrapperStyle}>

                    {/* === LEFT PANEL: VIDEO & CONTROLS === */}
                    <div style={leftPanelStyle}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                            Kamera & Kontrol
                        </h2>

                        {/* Video / Placeholder Container */}
                        <div style={{ position: 'relative', marginBottom: '1.5rem', borderRadius: '0.75rem', overflow: 'hidden' }}>

                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted={true}
                                style={{
                                    ...videoStyle,
                                    display: isDetecting ? 'block' : 'none',
                                }}
                            />

                            {/* Placeholder */}
                            {!isDetecting && (
                                <div style={videoPlaceholderStyle}>
                                    <CameraIcon style={{ height: '3rem', width: '3rem', color: '#9ca3af' }} />
                                    <p style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280', marginTop: '0.75rem' }}>
                                        Kamera dinonaktifkan
                                    </p>
                                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                                        Tekan Mulai Deteksi untuk mengaktifkan.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Control Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {!isDetecting ? (
                                <button
                                    onClick={startDetection}
                                    style={startButtonStyle}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'} // blue-600
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryColor}
                                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.99)'}
                                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <PlayIcon style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} />
                                    Mulai Deteksi
                                </button>
                            ) : (
                                <button
                                    onClick={() => stopDetection(true)}
                                    style={stopButtonStyle}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'} // red-600
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.99)'}
                                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <StopIcon style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} />
                                    Berhenti & Simpan Sesi
                                </button>
                            )}
                        </div>

                        {/* Warning / Notification Area */}
                        {warning && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                fontWeight: '500',
                                borderRadius: '0.5rem',
                                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                borderLeft: warning.startsWith('⚠️') ? '4px solid #f59e0b' : warning.startsWith('✅') ? '4px solid #10b981' : '4px solid #ef4444',
                                backgroundColor: warning.startsWith('⚠️') ? '#fffbe6' : warning.startsWith('✅') ? '#ecfdf5' : '#fee2e2',
                                color: warning.startsWith('⚠️') ? '#b58b02' : warning.startsWith('✅') ? '#047857' : '#b91c1c',
                            }}>
                                {warning}
                            </div>
                        )}
                    </div>


                    {/* === RIGHT PANEL: STATS DISPLAY (always visible) === */}
                    <div style={rightPanelStyle}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem', borderBottom: '1px solid #bfdbfe', paddingBottom: '0.5rem' }}>
                            Statistik Real-time
                        </h2>

                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                            Status deteksi: {isDetecting ? (
                                <span style={{ color: '#10b981', fontWeight: 'bold' }}>AKTIF</span>
                            ) : (
                                <span style={{ color: '#f97316', fontWeight: 'bold' }}>TIDAK AKTIF</span>
                            )}
                        </p>

                        <div style={statsGridStyle}>
                            {/* Total Blinks */}
                            <div style={statItemStyle}>
                                <BlinksIcon style={{ height: '1.5rem', width: '1.5rem', color: primaryColor, marginBottom: '0.5rem' }} />
                                <p style={{ fontSize: '2rem', fontWeight: '800', color: primaryColor, lineHeight: 1 }}>
                                    {isDetecting ? stats.total_blinks : '--'}
                                </p>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '500', marginTop: '0.25rem' }}>
                                    Total Kedipan
                                </p>
                            </div>

                            {/* Blink Rate */}
                            <div style={statItemStyle}>
                                <RateIcon style={{ height: '1.5rem', width: '1.5rem', color: primaryColor, marginBottom: '0.5rem' }} />
                                <p style={{ fontSize: '2rem', fontWeight: '800', color: primaryColor, lineHeight: 1 }}>
                                    {isDetecting ? stats.blink_rate : '--'}
                                </p>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '500', marginTop: '0.25rem' }}>
                                    Rate (per menit)
                                </p>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px dashed #bfdbfe' }}>
                            <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                                **Catatan:** Laju kedipan normal adalah **12-15 kedipan per menit**. Nilai di bawah ini dapat mengindikasikan ketegangan mata.
                            </p>
                        </div>
                    </div>

                </div> {/* End Content Wrapper */}

                {/* API URL Info */}
                <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af' }}>API Endpoint: {API_URL}</p>
            </div>
        </div>
    );
}

export default Detect;
