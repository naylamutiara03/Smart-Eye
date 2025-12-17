// frontend/src/pages/Home.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API_URL = 'http://127.0.0.1:5000';


function Home() {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null); // State ini menyimpan object user Supabase
  const [error, setError] = useState(null);

  // State baru untuk menyimpan raw data dan filter
  const [rawData, setRawData] = useState([]);
  const [timeRange, setTimeRange] = useState('7'); // Default 7 hari
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();

  // ========================================================
  // >>> PERUBAHAN BARU: Mengatur Judul Halaman <<<
  // ========================================================
  useEffect(() => {
    document.title = 'Home';

    // Cleanup function: mengembalikan judul lama saat komponen di-unmount 
    // (Opsional, tapi baik untuk menjaga kebersihan jika Anda ingin judul default)
    return () => {
      document.title = 'React App'; // Ganti dengan judul default aplikasi Anda jika ada
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
        fetchHistory(session.user);
      }
    };
    checkSession();
  }, [navigate]);

  // 1. Ambil semua data, tapi simpan ke RawData dulu
  const fetchHistory = async (currentUser) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/history`, {
        params: { user_id: currentUser.id },
      });

      // Simpan data mentah (pastikan backend mengirim array obyek lengkap)
      // Kita reverse di sini agar urutan waktu benar (lama -> baru) sebelum diproses
      const records = response.data.reverse();
      setRawData(records);

    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Gagal memuat data history. Pastikan backend Flask berjalan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 2. Logic Pengolahan Data (Dijalankan setiap kali rawData atau timeRange berubah)
  useEffect(() => {
    if (rawData.length === 0) {
      setChartData(null);
      return;
    }

    const processData = () => {
      const now = new Date();
      // Hitung tanggal batas (cutoff) berdasarkan timeRange
      const cutoffDate = new Date();
      cutoffDate.setDate(now.getDate() - parseInt(timeRange));

      // Langkah A: Filter data berdasarkan range tanggal
      const filteredData = rawData.filter(item => {
        const itemDate = new Date(item.captured_at);
        return itemDate >= cutoffDate;
      });

      if (filteredData.length === 0) {
        setChartData(null);
        return;
      }

      // Langkah B: Grouping by Date (Mengelompokkan data per hari)
      // Struktur groupedData: { "25/11/2023": [12, 15, 10], "26/11/2023": [20, ...] }
      const groupedData = {};

      filteredData.forEach(item => {
        const dateObj = new Date(item.captured_at);
        // Format tanggal (DD/MM) sebagai label
        const dateKey = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        if (!groupedData[dateKey]) {
          groupedData[dateKey] = [];
        }
        groupedData[dateKey].push(item.blink_per_minute || 0);
      });

      // Langkah C: Hitung Rata-rata per hari
      const labels = Object.keys(groupedData);
      const dataPoints = labels.map(date => {
        const values = groupedData[date];
        const sum = values.reduce((a, b) => a + b, 0);
        return (sum / values.length).toFixed(1); // Ambil 1 desimal
      });

      // Set Chart Data
      setChartData({
        labels,
        datasets: [
          {
            label: `Rata-rata Kedipan (${timeRange} Hari Terakhir)`,
            data: dataPoints,
            fill: true,
            borderColor: '#0d6efd',
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 450);
              gradient.addColorStop(0, 'rgba(13, 110, 253, 0.4)');
              gradient.addColorStop(1, 'rgba(13, 110, 253, 0.05)');
              return gradient;
            },
            tension: 0.4, // Kurva lebih mulus
            pointBackgroundColor: '#fff',
            pointBorderColor: '#0d6efd',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            borderWidth: 3,
          },
        ],
      });
    };

    processData();
  }, [rawData, timeRange]); // Re-run logic jika data baru masuk atau filter berubah

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchHistory(user);
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: 'Poppins' } },
      },
      title: {
        display: false, // Title dipindah ke header card
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#000',
        bodyColor: '#666',
        borderColor: '#ddd',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function (context) {
            return `Rata-rata: ${context.parsed.y} kedipan/menit`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { borderDash: [5, 5] },
        title: { display: true, text: 'Rata-rata Kedipan' }
      },
      x: {
        grid: { display: false },
        title: { display: true, text: 'Tanggal' }
      },
    },
  };

  return (
    <div className="page-content">
      <div className="container mb-5">
        <div className="container mt-5 mb-5">
          <div className="text-center mb-4">
            <h2 className="fw-bold text-primary">Dashboard EyeCare</h2>
            <p className="text-muted mb-1">
              Login sebagai:
              <strong className="text-secondary ms-1">
                {user ? user.email : 'Memuat...'}
              </strong>
            </p>
            <p className="text-muted mt-0">Pantau kebiasaan dan kesehatan mata Anda.</p>
          </div>

          <div className="card shadow-lg border-0 rounded-4 mx-auto" style={{ maxWidth: '1000px' }}>
            {/* HEADER CARD: Judul & Kontrol Filter (PERUBAHAN DI SINI) */}
            <div className="card-header bg-white border-bottom-0 pt-4 px-4 d-flex flex-wrap 
 justify-content-center justify-content-md-between align-items-center gap-3">
              {/* Judul Analisis (text-center pada layar kecil) */}
              <div className="text-center text-md-start">
                <h5 className="mb-1 fw-bold text-dark">Analisis Kebiasaan</h5>
                <small className="text-muted">Grafik rata-rata harian</small>
              </div>

              {/* Kontrol Filter (Diatur rata tengah pada layar kecil) */}
              <div className="d-flex gap-2 justify-content-center">
                {/* DROPDOWN FILTER HARI */}
                <select
                  className="form-select form-select-sm shadow-none border-secondary-subtle"
                  style={{ width: '150px', borderRadius: '8px' }}
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option value="7">7 Hari Terakhir</option>
                  <option value="14">14 Hari Terakhir</option>
                  <option value="30">30 Hari Terakhir</option>
                  <option value="90">3 Bulan (Trend)</option>
                </select>

                <button
                  className="btn btn-primary btn-sm rounded-3 px-3"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  {refreshing ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="card-body p-4" style={{ height: '450px' }}>
              {loading ? (
                <div className="d-flex flex-column justify-content-center align-items-center h-100">
                  <div className="spinner-border text-primary mb-3" role="status" />
                  <p className="text-muted">Mengambil data...</p>
                </div>
              ) : error ? (
                <div className="alert alert-danger">{error}</div>
              ) : chartData ? (
                <Line data={chartData} options={options} />
              ) : (
                <div className="d-flex flex-column justify-content-center align-items-center h-100 text-muted">
                  <i className="bi bi-bar-chart fs-1 mb-2 opacity-25"></i>
                  <p>Tidak ada data pada rentang waktu ini.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}

export default Home;
