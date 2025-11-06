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
  Legend 
} from 'chart.js';

// Mendaftarkan komponen Chart.js yang diperlukan
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const API_URL = 'http://127.0.0.1:5000';

function Home() {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login'); // Redirect jika belum login
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
      // Mengirim user.id sebagai query parameter
      const response = await axios.get(`${API_URL}/history`, {
        params: { 
          user_id: user.id // Mengirim ID pengguna yang sedang login
        }
      });
      
      const records = response.data.reverse(); 

      if (records.length === 0) {
        setChartData(null);
        return;
      }

      const labels = records.map(r =>
        // Menggunakan format waktu yang sama
        new Date(r.captured_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      );
      const blinksPerMinute = records.map(r => r.blink_per_minute || 0);

      setChartData({
        labels,
        datasets: [{
          label: 'Rata-rata Kedipan per Menit',
          data: blinksPerMinute,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          tension: 0.2, 
          fill: false 
        }]
      });

    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Gagal memuat data history. Pastikan backend Flask berjalan dan user ID valid.");
      setChartData(null);
    } finally {
      setLoading(false);
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, 
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Grafik History Rata-rata Kedipan Mata' },
    },
    scales: {
      y: { 
        beginAtZero: true, 
        title: { display: true, text: 'Kedipan/menit' } 
      },
      x: { title: { display: true, text: 'Waktu Sesi' } }
    }
  };

  return (
    <div className="container mt-5">
      <div className="text-center p-3">
        <h2 className="display-4 font-weight-bold mb-1">Selamat Datang di EyeCare</h2>
        {user && <p className="text-muted mb-4">Login sebagai: <span className="font-weight-bold">{user.email}</span></p>}
        <p className="lead mb-5">Aplikasi untuk memantau kesehatan mata Anda saat di depan layar.</p>
      </div>
      
      {/* Container untuk Grafik (Menggunakan Card Bootstrap) */}
      <div className="card shadow mx-auto" style={{ maxWidth: '900px' }}>
        <div className="card-body p-4" style={{ height: '400px' }}>
          {loading && (
            <div className="d-flex justify-content-center align-items-center h-100">
              <p>Memuat data grafik...</p>
            </div>
          )}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          
          {/* Tampilkan grafik jika data ada dan tidak error */}
          {!loading && !error && chartData && chartData.labels.length > 0 ? (
            <div style={{ width: '100%', height: '100%' }}>
              <Line options={options} data={chartData} />
            </div>
          ) : (
            !loading && !error && <p className="text-muted mt-4 text-center">Belum ada history deteksi untuk ditampilkan di grafik. Silakan mulai deteksi terlebih dahulu!</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;