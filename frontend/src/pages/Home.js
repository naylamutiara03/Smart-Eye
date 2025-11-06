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
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

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

  const fetchHistory = async (user) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/history`, {
        params: { user_id: user.id },
      });

      const records = response.data.reverse();

      if (records.length === 0) {
        setChartData(null);
        return;
      }

      const labels = records.map((r) =>
        new Date(r.captured_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      );
      const blinksPerMinute = records.map((r) => r.blink_per_minute || 0);

      setChartData({
        labels,
        datasets: [
          {
            label: 'Rata-rata Kedipan per Menit',
            data: blinksPerMinute,
            fill: true,
            borderColor: '#0d6efd',
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 450);
              gradient.addColorStop(0, 'rgba(13, 110, 253, 0.3)');
              gradient.addColorStop(1, 'rgba(13, 110, 253, 0)');
              return gradient;
            },
            tension: 0.35,
            pointBackgroundColor: '#0d6efd',
            pointBorderColor: '#fff',
            pointHoverRadius: 6,
            borderWidth: 3,
          },
        ],
      });
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Gagal memuat data history. Pastikan backend Flask berjalan dan user ID valid.');
      setChartData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
        labels: {
          color: '#333',
          font: { size: 13, family: 'Poppins, sans-serif' },
        },
      },
      title: {
        display: true,
        text: 'Grafik Rata-rata Kedipan Mata (Blink History)',
        color: '#212529',
        font: { size: 16, weight: 'bold', family: 'Poppins, sans-serif' },
        padding: { bottom: 20 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Kedipan per Menit',
          color: '#495057',
          font: { size: 12, weight: '600' },
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        title: {
          display: true,
          text: 'Waktu Sesi',
          color: '#495057',
          font: { size: 12, weight: '600' },
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  };

  return (
    <div className="container mt-5">
      <div className="text-center p-3 mb-4">
        <h2 className="fw-bold text-primary mb-1">Selamat Datang di EyeCare</h2>
        {user && (
          <p className="text-muted mb-4">
            Login sebagai: <span className="fw-semibold">{user.email}</span>
          </p>
        )}
        <p className="lead text-secondary">
          Aplikasi untuk memantau kesehatan mata Anda saat di depan layar.
        </p>
      </div>

      {/* CARD GRAFIK */}
      <div
        className="card shadow-lg border-0 rounded-4 mx-auto"
        style={{
          maxWidth: '1100px',
          background: 'linear-gradient(to bottom right, #ffffff, #f8f9fa)',
        }}
      >
        <div className="card-header d-flex justify-content-between align-items-center bg-transparent border-0 px-4 pt-4 pb-2">
          <h5 className="mb-0 fw-bold text-secondary">Riwayat Kedipan Mata Anda</h5>
          <button
            className="btn btn-outline-primary btn-sm d-flex align-items-center"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <div className="spinner-border spinner-border-sm me-2" role="status" />
                Memuat...
              </>
            ) : (
              <>
                🔄 <span className="ms-1">Refresh</span>
              </>
            )}
          </button>
        </div>

        <div className="card-body p-4" style={{ height: '400px' }}>
          {loading ? (
            <div className="d-flex justify-content-center align-items-center h-100">
              <div className="spinner-border text-primary me-2" role="status" />
              <p className="mb-0">Memuat data grafik...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger text-center">{error}</div>
          ) : chartData && chartData.labels.length > 0 ? (
            <div style={{ width: '100%', height: '100%' }}>
              <Line data={chartData} options={options} />
            </div>
          ) : (
            <p className="text-muted text-center mt-4">
              Belum ada history deteksi untuk ditampilkan. Silakan mulai deteksi terlebih dahulu!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
