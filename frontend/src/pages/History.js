// frontend/src/pages/History.js
import React, { useState, useEffect } from "react";
import { fetchHistory } from "../api/blink"; // ✅ pakai helper API

// sementara hardcode; ganti dari auth/device context jika sudah ada
const USER_ID = 1;     // FK → profiles.id
const DEVICE_ID = 2;   // FK → devices.id

// base URL backend (pakai .env kalau ada, fallback ke localhost:5000)
const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:5000";

function History() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    try {
      const rows = await fetchHistory({ userId: USER_ID, deviceId: DEVICE_ID, limit: 50 });
      setRecords(rows ?? []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id) => {
    if (!id) return;
    const ok = window.confirm("Yakin ingin menghapus data ini?");
    if (!ok) return;

    try {
      setDeletingId(id);
      // panggil endpoint DELETE /history/:id
      const res = await fetch(`${API_BASE}/history/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Gagal menghapus (status ${res.status})`);
      }
      // Optimistic update: keluarkan item dari state
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Error deleting record:", err);
      alert("❌ Gagal menghapus data. Coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <p>Memuat history...</p>;

  return (
    <div className="p-4">
      <h2 className="mb-4">History Deteksi Kedipan</h2>

      {records.length > 0 ? (
        <table className="table table-bordered table-hover text-center">
          <thead className="table-dark">
            <tr>
              <th>No</th>
              <th>Waktu (captured_at)</th>
              <th>Total Kedipan</th>
              <th>Blink/Min</th>
              <th>Durasi Menatap (detik)</th>
              <th>Peringatan?</th>
              <th>Aksi</th> {/* ✅ kolom baru */}
            </tr>
          </thead>
          <tbody>
            {records.map((r, index) => (
              <tr key={r.id ?? `${r.captured_at}-${index}`}>
                <td>{index + 1}</td>
                <td>{r.captured_at ? new Date(r.captured_at).toLocaleString("id-ID") : "-"}</td>
                <td>{r.blink_count ?? "-"}</td>
                <td>{r.blink_per_minute ?? "-"}</td>
                <td>{r.stare_duration_sec ?? "-"}</td>
                <td>{r.warning_triggered ? "Ya" : "Tidak"}</td>
                <td>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    style={{
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      cursor: deletingId === r.id ? "not-allowed" : "pointer",
                      opacity: deletingId === r.id ? 0.7 : 1,
                    }}
                    title="Hapus record ini"
                  >
                    {deletingId === r.id ? "Menghapus..." : "Hapus"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted">Belum ada history deteksi.</p>
      )}
    </div>
  );
}

export default History;
