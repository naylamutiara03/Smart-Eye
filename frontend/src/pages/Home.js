// frontend/src/pages/Home.js
import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { fetchHistory } from "../api/blink"; // ✅ gunakan helper API

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// sementara: hardcode; ganti dari auth/device context kalau sudah ada
const USER_ID = 1;   // FK → profiles.id
const DEVICE_ID = 2; // FK → devices.id

export default function Home() {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // ambil 50 data terakhir untuk user+device ini (backend mengembalikan desc)
        const rowsDesc = await fetchHistory({ userId: USER_ID, deviceId: DEVICE_ID, limit: 50 });
        const rows = [...(rowsDesc ?? [])].reverse(); // → kronologis (lama → baru)

        const labels = rows.map(r =>
          r.captured_at ? new Date(r.captured_at).toLocaleTimeString("id-ID") : "-"
        );

        // gunakan langsung kolom blink_per_minute dari ERD
        const series = rows.map(r =>
          typeof r.blink_per_minute === "number" ? Number(r.blink_per_minute.toFixed(2)) : 0
        );

        if (alive) {
          setChartData({
            labels,
            datasets: [
              {
                label: "Rata-rata Kedipan per Menit",
                data: series,
                borderColor: "rgb(75, 192, 192)",
                backgroundColor: "rgba(75, 192, 192, 0.5)",
                tension: 0.1,
                pointRadius: 2,
              },
            ],
          });
        }
      } catch (err) {
        console.error("Error fetch history:", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Grafik History Rata-rata Kedipan Mata" },
      tooltip: { mode: "index", intersect: false },
    },
    interaction: { mode: "nearest", intersect: false },
    scales: {
      y: { title: { display: true, text: "Kedipan/menit" }, beginAtZero: true },
      x: { title: { display: true, text: "Waktu" } },
    },
  };

  return (
    <div className="text-center">
      <h2>Selamat Datang di EyeCare</h2>
      <p className="lead">Aplikasi untuk memantau kesehatan mata Anda saat di depan layar.</p>

      <div className="mt-5 card p-3">
        {loading && <p>Memuat data grafik...</p>}
        {!loading && chartData && <Line options={options} data={chartData} />}
        {!loading && !chartData && <p>Gagal memuat data atau belum ada history.</p>}
      </div>
    </div>
  );
}
