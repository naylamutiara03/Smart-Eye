// frontend/src/pages/History.js
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

import { AlertTriangle, Clock, Eye, Activity, Zap } from "feather-icons-react";

const API_URL = "http://127.0.0.1:5000";

function History() {
  const [records, setRecords] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("all");

  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [error, setError] = useState(null);

  const navigate = useNavigate();

  // Untuk nampilin nama device di UI
  const selectedDeviceName = useMemo(() => {
    if (selectedDevice === "all") return "Semua Perangkat";
    const found = devices.find((d) => String(d.id) === String(selectedDevice));
    return found?.name || found?.device_name || `Device ${selectedDevice}`;
  }, [selectedDevice, devices]);

  useEffect(() => {
    document.title = "History";
    return () => {
      document.title = "React App";
    };
  }, []);

  // Memastikan login + fetch devices
  useEffect(() => {
    const init = async () => {
      setError(null);
      setLoadingDevices(true);
      setLoadingHistory(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const userId = session.user.id;

      try {
        // Mengambil devices dari endpoint baru
        // Fallback pakai user_id query param
        const devRes = await axios.get(`${API_URL}/api/devices`, {
          params: { user_id: userId },
        });

        // Normalisasi bentuk data supaya konsisten untuk dropdown
        const normalized = (devRes.data || []).map((d) => ({
          id: d.id,
          name: d.device_name || d.name || d.hardware_id || `Device ${d.id}`,
          ...d,
        }));

        setDevices(normalized);

        // Default: kalau ada device → pilih device pertama
        // Tetap bisa ubah ke "all" 
        if (normalized.length > 0) {
          setSelectedDevice(String(normalized[0].id));
        } else {
          setSelectedDevice("all");
        }
      } catch (err) {
        console.error("Error fetching devices:", err);
        setDevices([]);
        setSelectedDevice("all");
        setError("Gagal memuat daftar perangkat.");
      } finally {
        setLoadingDevices(false);
      }
    };

    init();
  }, [navigate]);

  // Fetch history berdasarkan pilihan device
  useEffect(() => {
    const fetchHistory = async () => {
      setError(null);
      setLoadingHistory(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const userId = session.user.id;

      try {
        let res;

        // Jika pilih "all" → pakai endpoint lama /history
        if (selectedDevice === "all") {
          res = await axios.get(`${API_URL}/history`, {
            params: { user_id: userId },
          });
        } else {
          // Jika pilih device tertentu → pakai endpoint baru /api/history/<device_id>
          res = await axios.get(`${API_URL}/api/history/${selectedDevice}`, {
            params: { user_id: userId },
          });
        }

        setRecords(res.data || []);
      } catch (err) {
        console.error("Error fetching history:", err);
        setRecords([]);
        setError("Gagal memuat data history.");
      } finally {
        setLoadingHistory(false);
      }
    };

    // Tidak fetch history sebelum devices selesai 
    if (!loadingDevices) {
      fetchHistory();
    }
  }, [selectedDevice, loadingDevices, navigate]);

  const handleDeviceChange = (e) => {
    setSelectedDevice(e.target.value);
  };

  if (loadingDevices || loadingHistory) {
    return (
      <p className="text-center mt-5">
        <Zap size={20} className="me-2" />
        Memuat history...
      </p>
    );
  }

  return (
    <div className="page-content">
      <div className="container mb-5 mt-4">
        <h2 className="mb-4 text-center">History Sesi Deteksi 👀</h2>

        {/* Error */}
        {error && (
          <div className="alert alert-danger shadow-sm text-center">
            {error}
          </div>
        )}

        {/* Device selector */}
        <div className="card shadow-sm border-0 mb-3">
          <div className="card-body d-flex flex-column flex-md-row align-items-md-center gap-2 justify-content-between">
            <div className="fw-semibold">
              Pilih Perangkat:
              <span className="ms-2 badge bg-secondary bg-opacity-75">
                {selectedDeviceName}
              </span>
            </div>

            <div style={{ minWidth: 260 }}>
              <select
                className="form-select"
                value={selectedDevice}
                onChange={handleDeviceChange}
              >
                <option value="all">-- Semua Perangkat --</option>

                {devices.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {records.length > 0 ? (
          <div className="card shadow-lg border-0">
            <div className="card-header bg-primary text-white p-3 d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Daftar Sesi Perekaman</h5>
              <small className="opacity-75">
                Filter: {selectedDeviceName}
              </small>
            </div>

            <div className="card-body table-responsive">
              <table className="table table-striped table-hover align-middle text-center">
                <thead className="table-light">
                  <tr>
                    <th>
                      <Zap size={16} /> No
                    </th>
                    <th>
                      <Clock size={16} /> Waktu Sesi
                    </th>
                    <th>
                      <Eye size={16} /> Total Kedipan
                    </th>
                    <th>
                      <Activity size={16} /> Laju (BPM)
                    </th>
                    <th>
                      <Clock size={16} /> Durasi (dtk)
                    </th>
                    <th className="text-start">Mode</th>
                    <th>
                      <AlertTriangle size={16} /> Peringatan
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((r, index) => {
                    const mode = r.detection_mode
                      ? String(r.detection_mode).toUpperCase()
                      : "FOCUS";

                    const modeClass = mode === "STRICT" ? "bg-danger" : "bg-success";

                    const warningIcon = r.warning_triggered ? (
                      <AlertTriangle size={20} color="red" />
                    ) : (
                      <span style={{ color: "green" }}>Normal</span>
                    );

                    return (
                      <tr
                        key={r.id || index}
                        className={r.warning_triggered ? "table-warning" : ""}
                      >
                        <td>{index + 1}</td>

                        <td className="text-nowrap">
                          {r.captured_at
                            ? new Date(r.captured_at).toLocaleString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>

                        <td>{r.blink_count ?? 0}</td>

                        <td>
                          <strong>{r.blink_per_minute ?? 0}</strong>
                        </td>

                        <td>{r.stare_duration_sec ?? 0}</td>

                        <td className="text-start">
                          <span className={`badge ${modeClass} bg-opacity-75`}>
                            {mode}
                          </span>
                        </td>

                        <td>{warningIcon}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="card-footer text-muted text-end">
              Data diambil dari {selectedDevice === "all" ? "20" : "50"} sesi terakhir.
            </div>
          </div>
        ) : (
          <div className="alert alert-info text-center shadow-sm">
            <p className="mb-0">
              <Eye size={20} className="me-2" />
              Belum ada riwayat deteksi yang tercatat untuk{" "}
              <strong>{selectedDeviceName}</strong>.
            </p>
            <small>Coba mulai sesi deteksi dari halaman Deteksi.</small>
          </div>
        )}
      </div>
    </div>
  );
}

export default History;
