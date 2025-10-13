import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

// Konfigurasi API
const API_URL = 'http://127.0.0.1:5000';

// Ikon menggunakan inline SVG
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
  const [warning, setWarning] = useState(''); // dapat berisi HTML (dengan tombol)
  const [warningText, setWarningText] = useState(''); // teks ringkas
  const [startTime, setStartTime] = useState(null);
  const [showHistoryButton, setShowHistoryButton] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // Audio untuk notifikasi
  const beep = useRef(new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg"));

  // Request permission notifikasi
  useEffect(() => {
    if (Notification && Notification.permission !== "granted") {
      Notification.requestPermission().catch(() => {});
    }
    return () => {
      stopDetection(false); // cleanup
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNotification = (text) => {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission === "granted") {
        // Hanya tampilkan notifikasi jika tab tidak aktif/tersembunyi
        if (!document.hidden) return;
        new Notification("EyeCare Alert", {
          body: text,
          icon: "https://cdn-icons-png.flaticon.com/512/709/709496.png"
        });
      }
    } catch (e) {
      console.warn("Notification error:", e.message);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    const width = 240;
    const height = (videoRef.current.videoHeight / videoRef.current.videoWidth) * width;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.6);
  };

  const startDetection = async () => {
    try {
      if (!videoRef.current) {
        setWarning("❌ Tidak bisa memulai deteksi. Elemen video belum siap.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setStartTime(new Date().toISOString()); 
      setIsDetecting(true);
      setWarning('');
      setWarningText('');

      // Interval: gunakan 300ms agar CPU friendly namun responsif.
      intervalRef.current = setInterval(async () => {
        const frame = captureFrame();
        if (!frame) return;

        try {
          let res;
          // Retry 3x dengan exponential backoff
          for (let i = 0; i < 3; i++) {
            try {
              res = await axios.post(`${API_URL}/process_frame`, { image: frame }, { timeout: 5000 });
              break;
            } catch (err) {
              if (i < 2) {
                await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
              } else {
                throw err;
              }
            }
          }
          if (!res) return;

          // Update stats
          setStats({
            total_blinks: res.data.total_blinks ?? 0,
            blink_rate: res.data.blink_rate ?? 0
          });

          // Handle pesan dari backend
          const msg = res.data.message || '';
          if (msg.includes("⚠️")) {
            setWarning(msg);
            // play beep (ignore failure)
            beep.current && beep.current.play().catch(() => {});
            showNotification(msg);
          } else if (msg.includes("✅")) {
            // session finished message — biarkan diproses saat stop
            // tidak overwrite warningText jika sudah ada sesi selesai
          } else {
            // jika tidak ada peringatan aktif, clear warning kecuali sudah ada warningText success
            if (!warningText.startsWith('✅')) {
              setWarning('');
            }
          }
        } catch (err) {
          console.error("Error processing frame:", err);
          setWarning("Gagal memproses frame atau koneksi terputus.");
          // dalam kasus kegagalan persistent, hentikan deteksi namun tanpa menyimpan
          stopDetection(false);
        }
      }, 300);
    } catch (err) {
      console.error("startDetection error:", err);
      setWarning("❌ Tidak bisa mengakses kamera: " + (err?.message || err));
    }
  };

  const stopDetection = async (saveRecord = true) => {
    // cleanup interval dan stream
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) { /* ignore */ }
      if (videoRef.current) videoRef.current.srcObject = null;
      streamRef.current = null;
    }
    setIsDetecting(false);

    // Capture current stats snapshot before reset (so we send last known)
    const payload = {
      total_blinks: stats.total_blinks,
      blink_rate: stats.blink_rate,
      start_time: startTime,
      timestamp: new Date().toISOString()
    };

    // Reset stats displayed to avoid stale UI if user re-starts
    setStats({ total_blinks: 0, blink_rate: 0 });

    if (saveRecord) {
      try {
        const res = await axios.post(`${API_URL}/stop_detection`, payload, { timeout: 8000 });

        // success message + tombol riwayat (HTML)
        const successMessage = `✅ Sesi selesai! Total Kedipan: ${res.data.total_blinks ?? payload.total_blinks} (durasi ${res.data.duration ?? '?'} detik)`;

        const historyButtonHtml = `
          <a href="/history" 
             style="
               margin-left: 1rem; 
               padding: 0.5rem 1rem; 
               background-color: #10B981; 
               color: white; 
               border-radius: 0.5rem; 
               text-decoration: none; 
               font-weight: 600; 
               display: inline-block;
             ">
             Lihat Riwayat
          </a>
        `;

        // set warning (HTML) dan warningText (plain)
        setWarning(`${successMessage}. ${historyButtonHtml}`);
        setWarningText(successMessage);
        setShowHistoryButton(true);

        console.log("Deteksi dihentikan. Response:", res.data);
      } catch (err) {
        console.error("Error stopping detection:", err);
        setWarning(`Error saat menghentikan sesi: ${err?.message || err}`);
      }
    } else {
      // tidak menyimpan, hanya clear warning
      setWarning('');
      setWarningText('');
      setShowHistoryButton(false);
    }
  };

  // --- Styles (sama seperti sebelumnya) ---
  const primaryColor = '#3b82f6';
  const secondaryBg = '#e0f2fe';
  const mainContainerStyle = {
    fontFamily: 'Inter, sans-serif',
    minHeight: '100vh',
    backgroundColor: '#fffff',
    padding: '2rem 1rem',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  };
  const contentWrapperStyle = {
    display: 'flex',
    flexDirection: window.innerWidth > 768 ? 'row' : 'column',
    gap: '1.5rem',
    maxWidth: '1000px',
    width: '100%',
  };
  const cardBaseStyle = {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '1rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    transition: 'box-shadow 0.3s ease',
  };
  const leftPanelStyle = { ...cardBaseStyle, flex: window.innerWidth > 768 ? '3' : '1' };
  const rightPanelStyle = { ...cardBaseStyle, flex: window.innerWidth > 768 ? '2' : '1', backgroundColor: secondaryBg, display: 'flex', flexDirection: 'column' };
  const statsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' };
  const statItemStyle = { padding: '1rem', backgroundColor: 'white', borderRadius: '0.75rem', textAlign: 'center', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' };
  const videoStyle = { width: '100%', height: 'auto', aspectRatio: '4 / 3', objectFit: 'cover', transform: 'scaleX(-1)', borderRadius: '0.75rem', backgroundColor: '#374151' };
  const videoPlaceholderStyle = { ...videoStyle, aspectRatio: '4 / 3', border: '2px dashed #9ca3af', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', transform: 'none' };
  const buttonBaseStyle = { padding: '0.75rem 1.25rem', fontWeight: '600', borderRadius: '0.5rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', transition: 'background-color 0.3s, transform 0.1s, box-shadow 0.3s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };
  const startButtonStyle = { ...buttonBaseStyle, backgroundColor: primaryColor, color: 'white' };
  const stopButtonStyle = { ...buttonBaseStyle, backgroundColor: '#ef4444', color: 'white' };

  return (
    <div style={mainContainerStyle}>
      <div className="flex flex-col items-center w-full">
        <div style={contentWrapperStyle}>
          <div style={leftPanelStyle}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
              Kamera & Kontrol
            </h2>

            <div style={{ position: 'relative', marginBottom: '1.5rem', borderRadius: '0.75rem', overflow: 'hidden' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ ...videoStyle, display: isDetecting ? 'block' : 'none' }} />
              {!isDetecting && (
                <div style={videoPlaceholderStyle}>
                  <CameraIcon style={{ height: '3rem', width: '3rem', color: '#9ca3af' }} />
                  <p style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280', marginTop: '0.75rem' }}>Kamera dinonaktifkan</p>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem' }}>Tekan Mulai Deteksi untuk mengaktifkan.</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!isDetecting ? (
                <button onClick={startDetection} style={startButtonStyle}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryColor}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.99)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <PlayIcon style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} />
                  Mulai Deteksi
                </button>
              ) : (
                <button onClick={() => stopDetection(true)} style={stopButtonStyle}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
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
            {/* Warning / Notification Area */}
{(warning || warningText) && (
  <div style={{
    marginTop: '1rem',
    padding: '1rem',
    fontWeight: '500',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
  }}>
    {warning ? (
      <div
        style={{
          borderLeft: warning.startsWith('⚠️') ? '4px solid #f59e0b' : warning.startsWith('✅') ? '4px solid #10b981' : '4px solid #ef4444',
          backgroundColor: warning.startsWith('⚠️') ? '#fffbe6' : warning.startsWith('✅') ? '#ecfdf5' : '#fee2e2',
          color: warning.startsWith('⚠️') ? '#b58b02' : warning.startsWith('✅') ? '#047857' : '#b91c1c',
          padding: '0.5rem',
          borderRadius: '0.5rem'
        }}
        dangerouslySetInnerHTML={{ __html: warning }}
      />
    ) : (
      <div
        style={{
          borderLeft: warningText.startsWith('⚠️') ? '4px solid #f59e0b' : warningText.startsWith('✅') ? '4px solid #10b981' : '4px solid #ef4444',
          backgroundColor: warningText.startsWith('⚠️') ? '#fffbe6' : warningText.startsWith('✅') ? '#ecfdf5' : '#fee2e2',
          color: warningText.startsWith('⚠️') ? '#b58b02' : warningText.startsWith('✅') ? '#047857' : '#b91c1c',
          padding: '0.5rem',
          borderRadius: '0.5rem'
        }}
      >
        <span>{warningText}</span>
      </div>
    )}
  </div>
)}

          </div>

          <div style={rightPanelStyle}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem', borderBottom: '1px solid #bfdbfe', paddingBottom: '0.5rem' }}>
              Statistik Real-time
            </h2>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Status deteksi: {isDetecting ? <span style={{ color: '#10b981', fontWeight: 'bold' }}>AKTIF</span> : <span style={{ color: '#f97316', fontWeight: 'bold' }}>TIDAK AKTIF</span>}
            </p>

            <div style={statsGridStyle}>
              <div style={statItemStyle}>
                <BlinksIcon style={{ height: '1.5rem', width: '1.5rem', color: primaryColor, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '2rem', fontWeight: '800', color: primaryColor, lineHeight: 1 }}>{isDetecting ? stats.total_blinks : '--'}</p>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '500', marginTop: '0.25rem' }}>Total Kedipan</p>
              </div>

              <div style={statItemStyle}>
                <RateIcon style={{ height: '1.5rem', width: '1.5rem', color: primaryColor, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '2rem', fontWeight: '800', color: primaryColor, lineHeight: 1 }}>{isDetecting ? stats.blink_rate : '--'}</p>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '500', marginTop: '0.25rem' }}>Rate (per menit)</p>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px dashed #bfdbfe' }}>
              <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                **Catatan:** Laju kedipan normal adalah <strong>12-15 kedipan per menit</strong>. Nilai di bawah ini dapat mengindikasikan ketegangan mata.
              </p>
            </div>
          </div>
        </div>

        <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af' }}>API Endpoint: {API_URL}</p>
      </div>
    </div>
  );
}

export default Detect;
