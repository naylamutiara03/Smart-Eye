// frontend/src/pages/History.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "../supabaseClient";

const API_URL = "http://127.0.0.1:5000";

function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUserAndHistory = async () => {
      try {
        // 🔹 1. Ambil user aktif dari Supabase
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          console.warn("Tidak ada user login.");
          setLoading(false);
          return;
        }

        setUser(user);

        // 🔹 2. Ambil history berdasarkan user.id
        const response = await axios.get(`${API_URL}/history`, {
          params: { user_id: user.id },
        });

        setRecords(response.data);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndHistory();
  }, []);

  if (loading) {
    return <p className="text-center mt-5">Memuat history...</p>;
  }

  if (!user) {
    return (
      <div className="text-center mt-5">
        <p className="text-muted">Silakan login untuk melihat riwayat deteksi.</p>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4 text-center">History Deteksi Anda</h2>
      {records.length > 0 ? (
        <table className="table table-bordered table-hover text-center">
          <thead className="table-dark">
            <tr>
              <th>No</th>
              <th>Waktu Terekam</th>
              <th>Total Kedipan</th>
              <th>Durasi (detik)</th>
              <th>Peringatan</th>
              <th>Catatan</th>
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
                <td>{r.warning_triggered ? "⚠️ Ya" : "✅ Tidak"}</td>
                <td>{r.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted text-center">
          Belum ada history deteksi untuk akun ini.
        </p>
      )}
    </div>
  );
}

export default History;
