// frontend/src/pages/History.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
// Import Feather Icons untuk ikon yang lebih modern (pastikan Anda menginstal: npm install feather-icons-react)
import { AlertTriangle, Clock, Eye, Activity, Zap } from 'feather-icons-react';

const API_URL = "http://127.00.1:5000";

function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate('/login');
        return;
      }

      const userId = session.user.id;

      try {
        const response = await axios.get(`${API_URL}/history`, {
          params: {
            user_id: userId,
          },
        });

        setRecords(response.data);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [navigate]);

  if (loading) return <p className="text-center mt-5"><Zap size={20} className="me-2"/>Memuat history...</p>;

  return (
    <div className="page-content">
      <div className="container mb-5 mt-4">
        <h2 className="mb-4 text-center">History Sesi Deteksi 👀</h2>

        {records.length > 0 ? (
          // === STRUKTUR CARD MODERN ===
          <div className="card shadow-lg border-0">
            <div className="card-header bg-primary text-white p-3">
                <h5 className="mb-0">Daftar Sesi Perekaman</h5>
            </div>
            {/* Membuat tabel responsif dengan .table-responsive */}
            <div className="card-body table-responsive"> 
              <table className="table table-striped table-hover align-middle text-center">
                <thead className="table-light">
                  <tr>
                    <th><Zap size={16}/> No</th>
                    <th><Clock size={16}/> Waktu Sesi</th>
                    <th><Eye size={16}/> Total Kedipan</th>
                    <th><Activity size={16}/> Laju (BPM)</th>
                    <th><Clock size={16}/> Durasi (dtk)</th>
                    <th className="text-start">Mode</th>
                    <th><AlertTriangle size={16}/> Peringatan</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, index) => {
                    const mode = r.detection_mode ? r.detection_mode.toUpperCase() : 'FOCUS';
                    const modeClass = mode === 'STRICT' ? 'bg-danger' : 'bg-success';
                    const warningIcon = r.warning_triggered 
                        ? <AlertTriangle size={20} color="red" /> 
                        : <span style={{color: 'green'}}>Normal</span>;

                    return (
                      <tr key={r.id || index} className={r.warning_triggered ? 'table-warning' : ''}>
                        <td>{index + 1}</td>
                        <td className="text-nowrap">
                          {r.captured_at
                            ? new Date(r.captured_at).toLocaleString("id-ID", {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })
                            : "-"}
                        </td>
                        <td>{r.blink_count}</td>
                        {/* Menampilkan Blink Per Minute */}
                        <td>
                            <strong>{r.blink_per_minute || 0}</strong>
                        </td>
                        <td>{r.stare_duration_sec}</td>
                        {/* Menggunakan Badge untuk Mode Deteksi */}
                        <td className="text-start">
                          <span className={`badge ${modeClass} bg-opacity-75`}>{mode}</span>
                        </td>
                        {/* Menampilkan Ikon Peringatan */}
                        <td>{warningIcon}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card-footer text-muted text-end">
                Data diambil dari 20 sesi terakhir.
            </div>
          </div>
          // === AKHIR STRUKTUR CARD ===
        ) : (
          <div className="alert alert-info text-center shadow-sm">
            <p className="mb-0"><Eye size={20} className="me-2"/> Belum ada riwayat deteksi yang tercatat.</p>
            <small>Coba mulai sesi deteksi dari halaman Deteksi.</small>
          </div>
        )}
      </div>
    </div>
  );
}

export default History;