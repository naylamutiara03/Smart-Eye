import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, 
  PointElement, LineElement, Title, Tooltip, Legend 
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const API_URL = 'http://127.0.0.1:5000';

function Home() {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/login'); // redirect jika belum login
      } else {
        setUser(data.session.user);
        fetchHistory(data.session.access_token);
      }
    });
  }, [navigate]);

  const fetchHistory = async (token) => {
    try {
      const response = await axios.get(`${API_URL}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const records = response.data.reverse();
      const labels = records.map(r =>
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
          tension: 0.2
        }]
      });
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Grafik History Rata-rata Kedipan Mata' },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Kedipan/menit' } },
      x: { title: { display: true, text: 'Waktu' } }
    }
  };

  return (
    <div className="text-center">
      <h2>Selamat Datang di EyeCare</h2>
      {user && <p className="text-gray-500">Login sebagai: {user.email}</p>}
      <p className="lead">Aplikasi untuk memantau kesehatan mata Anda saat di depan layar.</p>
      
      <div className="mt-5 card p-3">
        {loading && <p>Memuat data grafik...</p>}
        {!loading && chartData && <Line options={options} data={chartData} />}
        {!loading && !chartData && <p>Gagal memuat data atau belum ada history.</p>}
      </div>
    </div>
  );
}

export default Home;
