// frontend/src/pages/History.js
// frontend/src/pages/History.js
import React, { useState, useEffect } from "react";
import axios from "axios";
// Tambahkan import supabaseClient dan useNavigate untuk mendapatkan user
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const API_URL = "http://127.0.0.1:5000";

function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      // 1. Dapatkan sesi pengguna yang sedang login
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Jika tidak ada sesi (belum login), arahkan ke halaman login
        navigate('/login');
        return;
      }

      // Dapatkan ID pengguna (user_id)
      const userId = session.user.id;

      try {
        // 2. Kirim user_id sebagai query parameter ke backend
        const response = await axios.get(`${API_URL}/history`, {
          params: {
            user_id: userId, // Mengirim ID pengguna
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
  }, [navigate]); // Tambahkan navigate sebagai dependency

  if (loading) return <p>Memuat history...</p>;
  // ... (rest of the return statement is the same)
  // ...

  return (
    <div className="page-content">
      <div className="container mb-5">
        <div className="container mt-4">
          <h2 className="mb-4 text-center">History Deteksi Kedipan</h2>

          {records.length > 0 ? (
            <table className="table table-bordered table-hover text-center">
              <thead className="table-dark">
                <tr>
                  <th>No</th>
                  <th>Waktu Terekam</th>
                  <th>Total Kedipan</th>
                  <th>Durasi (detik)</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, index) => (
                  <tr key={r.id || index}>
                    <td>{index + 1}</td>
                    <td>
                      {r.captured_at
                        ? new Date(r.captured_at).toLocaleString("id-ID")
                        : "-"}
                    </td>
                    <td>{r.blink_count}</td>
                    <td>{r.stare_duration_sec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted text-center">Belum ada history deteksi.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default History;
