// frontend/src/pages/History.js
import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "http://127.0.0.1:5000";

function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(`${API_URL}/history`);
        setRecords(response.data);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) return <p>Memuat history...</p>;

  return (
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
              {/* <th>Kedipan/menit</th> */}
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
                {/* <td>{r.blink_per_minute}</td> */}
                <td>{r.warning_triggered ? "⚠️ Ya" : "✅ Tidak"}</td>
                <td>{r.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted text-center">Belum ada history deteksi.</p>
      )}
    </div>
  );
}

export default History;
