import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { supabase } from "../supabaseClient";
import { useDevice } from "../contexts/DeviceContext";

// Konfigurasi API
const API_URL = "http://127.0.0.1:5000";

// Ikon menggunakan inline SVG (PlayIcon, StopIcon, CameraIcon, BlinksIcon, RateIcon)
const PlayIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const StopIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="5" width="14" height="14" rx="2" ry="2"></rect>
  </svg>
);

const CameraIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 4h.5a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h.5"></path>
    <path d="M18 10l-4 4-2-2"></path>
    <circle cx="10" cy="10" r="8"></circle>
  </svg>
);

const BlinksIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M8 12s2 1 4 1 4-1 4-1"></path>
    <line x1="12" y1="8" x2="12" y2="12"></line>
  </svg>
);

const RateIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

// --- Mode Toggle Switch ---
const ModeToggle = ({ detectionMode, setDetectionMode, isDetecting }) => {
  const isStrict = detectionMode === "strict";
  const color = isStrict ? "#ef4444" : "#10b981"; // Merah untuk Strict, Hijau untuk Fokus

  const toggleStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    marginTop: "1.5rem",
    marginBottom: "1rem",
    opacity: isDetecting ? 0.6 : 1,
    pointerEvents: isDetecting ? "none" : "auto",
  };

  const switchContainerStyle = {
    width: "50px",
    height: "28px",
    backgroundColor: isStrict ? color : "#d1d5db",
    borderRadius: "14px",
    padding: "2px",
    cursor: "pointer",
    transition: "background-color 0.2s",
    position: "relative",
    marginLeft: "1rem",
  };

  const switchButtonStyle = {
    width: "24px",
    height: "24px",
    backgroundColor: "white",
    borderRadius: "50%",
    transition: "transform 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    transform: isStrict ? "translateX(22px)" : "translateX(0)",
  };

  return (
    <div style={toggleStyle}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: "700", color: isStrict ? color : "#1f2937" }}>
          Mode Deteksi: {isStrict ? "Strict" : "Fokus"}
        </span>
        <span style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
          {isStrict
            ? "Peringatan lebih sensitif dan sering."
            : "Peringatan standar, cocok untuk pekerjaan umum."}
        </span>
      </div>

      <div
        style={switchContainerStyle}
        onClick={() => setDetectionMode(isStrict ? "focus" : "strict")}
      >
        <div style={switchButtonStyle} />
      </div>
    </div>
  );
};

function Detect() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [stats, setStats] = useState({ total_blinks: 0, blink_rate: 0 });
  const [warning, setWarning] = useState("");
  const [warningText, setWarningText] = useState("");
  const warningTextRef = useRef(""); // biar bunyi warning tidak spam
  const [startTime, setStartTime] = useState(null);
  const [showHistoryButton, setShowHistoryButton] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);

  const { currentDevice } = useDevice();

  // --- STATE BARU: Detection Mode ('focus' atau 'strict') ---
  const [detectionMode, setDetectionMode] = useState("focus");

  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

  const intervalRef = useRef(null);

  // Audio untuk notifikasi
  const beep = useRef(
    new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg")
  );

  // Status kamera + detectionRunning
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectionRunning, setDetectionRunning] = useState(false);

  useEffect(() => {
    document.title = "Detect";
    return () => {
      document.title = "React App";
    };
  }, []);

  // --- EFFECT UNTUK HANDLE RESIZE DAN CLEANUP ---
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    if (Notification && Notification.permission !== "granted") {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (isDetecting) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Cek status kamera (polling 5 detik)
 
  useEffect(() => {
    let mounted = true;

    const checkCameraStatus = async () => {
      try {
        const res = await axios.get(`${API_URL}/stream/latest`, { timeout: 2000 });
        const online = res?.data?.status === "online";
        if (mounted) setIsCameraActive(online);
      } catch (err) {
        if (mounted) setIsCameraActive(false);
      }
    };

    checkCameraStatus();
    const camInterval = setInterval(checkCameraStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(camInterval);
    };
  }, []);

  const showNotification = (text) => {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission === "granted") {
        if (!document.hidden) return;
        new Notification("EyeCare Alert", {
          body: text,
          icon: "https://cdn-icons-png.flaticon.com/512/709/709496.png",
        });
      }
    } catch (e) {
      console.warn("Notification error:", e.message);
    }
  };

  // --- START DETECTION (POLLING MODE) ---
  const startDetection = async () => {
    try {
      // Cek kamera aktif dulu
      if (!isCameraActive) {
        setWarning("⚠️ Kamera offline. Pastikan camera_client.py berjalan.");
        setWarningText("⚠️ Kamera offline. Pastikan camera_client.py berjalan.");
        warningTextRef.current = "⚠️ Kamera offline. Pastikan camera_client.py berjalan.";
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setWarning("Anda harus login untuk memulai deteksi.");
        setWarningText("Anda harus login untuk memulai deteksi.");
        warningTextRef.current = "Anda harus login untuk memulai deteksi.";
        return;
      }

      setStartTime(new Date().toISOString());
      setIsDetecting(true);
      setDetectionRunning(true); // Sinkron
      setWarning("");
      setWarningText("");
      warningTextRef.current = "";
      setImageSrc(null);

      intervalRef.current = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/stream/latest`);

          if (res.data.status === "online") {
            const data = res.data.data;

            setImageSrc(data.image);

            setStats({
              total_blinks: data.blink_count ?? 0,
              blink_rate: data.blink_rate ?? 0,
            });

            const msg = data.message || "";
            if (msg.includes("⚠️")) {
              setWarning(msg);

              if (warningTextRef.current !== msg) {
                warningTextRef.current = msg;
                setWarningText(msg);
                beep.current && beep.current.play().catch(() => {});
                showNotification(msg);
              }
            } else if (msg.includes("✅")) {
              // normal
            } else {
              // clear warning jika bukan warning
              if (!warningTextRef.current.startsWith("✅")) {
                setWarning("");
              }
            }
          } else {
            setWarning("⚠️ Kamera offline. Pastikan camera_client.py berjalan.");
          }
        } catch (err) {
          console.error("Error polling stream:", err);
        }
      }, 100);
    } catch (err) {
      console.error("startDetection error:", err);
      setWarning("Gagal memulai sesi: " + (err?.message || err));
    }
  };

  // --- STOP DETECTION ---
  const stopDetection = async (saveRecord = true) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsDetecting(false);
    setDetectionRunning(false); // Sinkron
    setImageSrc(null);

    let userId = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        userId = session.user.id;
      }
    } catch (e) {
      console.error("Gagal mendapatkan sesi Supabase:", e);
    }

    const deviceId = currentDevice?.id || null;

    const payload = {
      total_blinks: stats.total_blinks,
      blink_rate: stats.blink_rate,
      start_time: startTime,
      end_time: new Date().toISOString(),
      user_id: userId,
      device_id: deviceId,
      detection_mode: detectionMode,
    };

    setStats({ total_blinks: 0, blink_rate: 0 });

    if (saveRecord && payload.user_id) {
      try {
        const res = await axios.post(`${API_URL}/stop_detection`, payload, {
          timeout: 8000,
        });

        const successMessage = `✅ Sesi (${detectionMode.toUpperCase()}) selesai! Total Kedipan: ${
          res.data.total_blinks ?? payload.total_blinks
        } (durasi ${res.data.duration ?? "?"} detik)`;

        const historyButtonHtml = `
          <a href="/history?user_id=${userId}"
            style="
              background-color: #10b981;
              color: white;
              padding: 0.25rem 0.75rem;
              border-radius: 0.375rem;
              text-decoration: none;
              font-weight: 600;
              margin-left: 1rem;
              display: inline-block;
            ">
            Lihat Riwayat
          </a>
        `;

        setWarning(`${successMessage}${historyButtonHtml}`);
        setWarningText(successMessage);
        warningTextRef.current = successMessage;
        setShowHistoryButton(true);
      } catch (err) {
        console.error("Error stopping detection:", err);
        setWarning(
          `Error saat menghentikan sesi: ${err?.message || err}. Data mungkin tidak tersimpan.`
        );
      }
    } else {
      setWarning("");
      setWarningText("");
      warningTextRef.current = "";
      setShowHistoryButton(false);

      if (saveRecord && !payload.user_id) {
        setWarning("❌ Gagal menyimpan riwayat. Anda tidak terautentikasi.");
      }
    }
  };

  // --- Styles ---
  const primaryColor = "#3b82f6";
  const secondaryBg = "#e0f2fe";
  const mainContainerStyle = {
    fontFamily: "Inter, sans-serif",
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    padding: "2rem 1rem",
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
  };

  const contentWrapperStyle = {
    display: "flex",
    flexDirection: isMobileView ? "column" : "row",
    gap: "1.5rem",
    maxWidth: "1000px",
    width: "100%",
  };

  const cardBaseStyle = {
    backgroundColor: "white",
    padding: "1.5rem",
    borderRadius: "1rem",
    boxShadow:
      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    transition: "box-shadow 0.3s ease",
  };

  const leftPanelStyle = {
    ...cardBaseStyle,
    flex: isMobileView ? "1" : "3",
  };

  const rightPanelStyle = {
    ...cardBaseStyle,
    flex: isMobileView ? "1" : "2",
    backgroundColor: secondaryBg,
    display: "flex",
    flexDirection: "column",
  };

  const statsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "1rem",
    marginTop: "1rem",
  };

  const statItemStyle = {
    padding: "1rem",
    backgroundColor: "white",
    borderRadius: "0.75rem",
    textAlign: "center",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  };

  const videoStyle = {
    width: "100%",
    height: "auto",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "0.75rem",
    backgroundColor: "#374151",
  };

  const videoPlaceholderStyle = {
    ...videoStyle,
    aspectRatio: "4 / 3",
    border: "2px dashed #9ca3af",
    backgroundColor: "#f3f4f6",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    transform: "none",
  };

  const buttonBaseStyle = {
    padding: "0.75rem 1.25rem",
    fontWeight: "600",
    borderRadius: "0.5rem",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    border: "none",
    transition: "background-color 0.3s, transform 0.1s, box-shadow 0.3s",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
  };

  const startButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: primaryColor,
    color: "white",
    opacity: !isCameraActive ? 0.6 : 1,
  };

  const stopButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: "#ef4444",
    color: "white",
  };

  return (
    <div className="page-content">
      <div className="container mb-5">
        <div style={mainContainerStyle}>
          <div className="flex flex-col items-center w-full">
            <h1
              style={{
                fontSize: isMobileView ? "2rem" : "2.5rem",
                fontWeight: "800",
                color: primaryColor,
                marginBottom: "1.5rem",
                textAlign: "center",
              }}
            >
              Detect Your Eyes 👁️
            </h1>

            <div style={contentWrapperStyle}>
              {/* Panel Kiri: Kamera & Kontrol */}
              <div style={leftPanelStyle}>
                <h2
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    color: "#1f2937",
                    marginBottom: "1rem",
                    borderBottom: "1px solid #e5e7eb",
                    paddingBottom: "0.5rem",
                  }}
                >
                  Kamera & Kontrol
                </h2>

                <div
                  style={{
                    position: "relative",
                    marginBottom: "1.5rem",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                    minHeight: "300px",
                    backgroundColor: "#f3f4f6",
                  }}
                >
                  {isDetecting && imageSrc ? (
                    <img
                      src={imageSrc}
                      alt="Live Stream"
                      style={{ ...videoStyle, display: "block" }}
                    />
                  ) : (
                    <div style={videoPlaceholderStyle}>
                      <CameraIcon
                        style={{
                          height: "3rem",
                          width: "3rem",
                          color: "#9ca3af",
                        }}
                      />
                      <p
                        style={{
                          fontSize: "1rem",
                          fontWeight: "600",
                          color: "#6b7280",
                          marginTop: "0.75rem",
                        }}
                      >
                        {isDetecting
                          ? "Menunggu koneksi kamera..."
                          : isCameraActive
                          ? "Kamera siap"
                          : "Kamera offline"}
                      </p>
                      <p
                        style={{
                          fontSize: "0.875rem",
                          color: "#9ca3af",
                          marginTop: "0.25rem",
                        }}
                      >
                        {isDetecting
                          ? "Pastikan camera_client.py berjalan"
                          : isCameraActive
                          ? "Tekan Mulai Deteksi untuk memulai."
                          : "Jalankan camera_client.py lalu refresh."}
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {!isDetecting ? (
                    <button
                      onClick={startDetection}
                      style={startButtonStyle}
                      disabled={!isCameraActive || detectionRunning}
                      onMouseEnter={(e) => {
                        if (!e.currentTarget.disabled)
                          e.currentTarget.style.backgroundColor = "#2563eb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = primaryColor;
                      }}
                      onMouseDown={(e) => {
                        if (!e.currentTarget.disabled)
                          e.currentTarget.style.transform = "scale(0.99)";
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <PlayIcon
                        style={{
                          height: "1.25rem",
                          width: "1.25rem",
                          marginRight: "0.5rem",
                        }}
                      />
                      {detectionRunning ? "Deteksi Berjalan..." : "Mulai Deteksi"}
                    </button>
                  ) : (
                    <button
                      onClick={() => stopDetection(true)}
                      style={stopButtonStyle}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#dc2626")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "#ef4444")
                      }
                      onMouseDown={(e) =>
                        (e.currentTarget.style.transform = "scale(0.99)")
                      }
                      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <StopIcon
                        style={{
                          height: "1.25rem",
                          width: "1.25rem",
                          marginRight: "0.5rem",
                        }}
                      />
                      Berhenti & Simpan Sesi
                    </button>
                  )}
                </div>

                {(warning || warningText) && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      fontWeight: "500",
                      borderRadius: "0.5rem",
                      boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)",
                    }}
                  >
                    {warning ? (
                      <div
                        style={{
                          borderLeft: warning.startsWith("⚠️")
                            ? "4px solid #f59e0b"
                            : warning.startsWith("✅")
                            ? "4px solid #10b981"
                            : "4px solid #ef4444",
                          backgroundColor: warning.startsWith("⚠️")
                            ? "#fffbe6"
                            : warning.startsWith("✅")
                            ? "#ecfdf5"
                            : "#fee2e2",
                          color: warning.startsWith("⚠️")
                            ? "#b58b02"
                            : warning.startsWith("✅")
                            ? "#047857"
                            : "#b91c1c",
                          padding: "0.5rem",
                          borderRadius: "0.5rem",
                        }}
                        dangerouslySetInnerHTML={{ __html: warning }}
                      />
                    ) : (
                      <div
                        style={{
                          borderLeft: warningText.startsWith("⚠️")
                            ? "4px solid #f59e0b"
                            : warningText.startsWith("✅")
                            ? "4px solid #10b981"
                            : "4px solid #ef4444",
                          backgroundColor: warningText.startsWith("⚠️")
                            ? "#fffbe6"
                            : warningText.startsWith("✅")
                            ? "#ecfdf5"
                            : "#fee2e2",
                          color: warningText.startsWith("⚠️")
                            ? "#b58b02"
                            : warningText.startsWith("✅")
                            ? "#047857"
                            : "#b91c1c",
                          padding: "0.5rem",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <span>{warningText}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Panel Kanan: Statistik Real-time */}
              <div style={rightPanelStyle}>
                <h2
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    color: "#1f2937",
                    marginBottom: "1rem",
                    borderBottom: "1px solid #bfdbfe",
                    paddingBottom: "0.5rem",
                  }}
                >
                  Statistik Real-time
                </h2>

                {/* ✅ TAMBAHAN: Status Kamera */}
                <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  Status kamera:{" "}
                  {isCameraActive ? (
                    <span style={{ color: "#10b981", fontWeight: "bold" }}>AKTIF</span>
                  ) : (
                    <span style={{ color: "#ef4444", fontWeight: "bold" }}>TIDAK AKTIF</span>
                  )}
                </p>

                <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  Status deteksi:{" "}
                  {isDetecting ? (
                    <span style={{ color: "#10b981", fontWeight: "bold" }}>AKTIF</span>
                  ) : (
                    <span style={{ color: "#f97316", fontWeight: "bold" }}>TIDAK AKTIF</span>
                  )}
                </p>

                <ModeToggle
                  detectionMode={detectionMode}
                  setDetectionMode={setDetectionMode}
                  isDetecting={isDetecting}
                />

                <div style={statsGridStyle}>
                  <div style={statItemStyle}>
                    <BlinksIcon
                      style={{
                        height: "1.5rem",
                        width: "1.5rem",
                        color: primaryColor,
                        marginBottom: "0.5rem",
                      }}
                    />
                    <p
                      style={{
                        fontSize: "2rem",
                        fontWeight: "800",
                        color: primaryColor,
                        lineHeight: 1,
                      }}
                    >
                      {isDetecting ? stats.total_blinks : "--"}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        color: "#6b7280",
                        fontWeight: "500",
                        marginTop: "0.25rem",
                      }}
                    >
                      Total Kedipan
                    </p>
                  </div>

                  <div style={statItemStyle}>
                    <RateIcon
                      style={{
                        height: "1.5rem",
                        width: "1.5rem",
                        color: primaryColor,
                        marginBottom: "0.5rem",
                      }}
                    />
                    <p
                      style={{
                        fontSize: "2rem",
                        fontWeight: "800",
                        color: primaryColor,
                        lineHeight: 1,
                      }}
                    >
                      {isDetecting ? stats.blink_rate : "--"}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        color: "#6b7280",
                        fontWeight: "500",
                        marginTop: "0.25rem",
                      }}
                    >
                      Rate (per menit)
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "1.5rem",
                    borderTop: "1px dashed #bfdbfe",
                  }}
                >
                  <p style={{ fontSize: "0.875rem", color: "#4b5563" }}>
                    **Catatan:** Laju kedipan normal adalah{" "}
                    <strong>12-15 kedipan per menit</strong>. Nilai di bawah ini
                    dapat mengindikasikan ketegangan mata.
                  </p>
                </div>
              </div>
            </div>

            <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#9ca3af" }}>
              API Endpoint: {API_URL}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Detect;
