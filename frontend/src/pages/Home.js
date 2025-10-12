// frontend/src/pages/Home.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Container, Card, Row, Col, Tabs, Tab, Spinner } from 'react-bootstrap';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const API_URL = 'http://127.0.0.1:5000';

function Home() {
    const [todayData, setTodayData] = useState(null);
    const [dailyData, setDailyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Opsi dan helper function yang tidak bergantung pada state/props bisa tetap di luar
    const createDataset = (label, data, color) => ({
        label,
        data,
        borderColor: color,
        backgroundColor: color.replace(')', ', 0.5)').replace('rgb', 'rgba'),
        tension: 0.2,
        fill: true,
    });

    const chartOptions = (title) => ({
        responsive: true,
        plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: title, font: { size: 16 } },
        },
        scales: { y: { beginAtZero: true } }
    });


    useEffect(() => {
        // **PINDAHKAN FUNGSI KE DALAM USEEFFECT**
        const processTodayData = (records) => {
            const today = new Date().toDateString();
            const todayRecords = records
                .filter(r => new Date(r.captured_at).toDateString() === today)
                .sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));

            if (todayRecords.length > 0) {
                const labels = todayRecords.map(r => new Date(r.captured_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
                const blinksPerMinute = todayRecords.map(r => 
                    r.stare_duration_sec > 0 
                        ? ((r.blink_count / r.stare_duration_sec) * 60).toFixed(2) 
                        : 0
                );

                setTodayData({
                    labels,
                    datasets: [createDataset('Rata-rata Kedipan per Menit (Hari Ini)', blinksPerMinute, 'rgb(75, 192, 192)')]
                });
            }
        };

        const processDailyData = (records) => {
            const dailyAggregates = records.reduce((acc, record) => {
                const dateKey = new Date(record.captured_at).toISOString().split('T')[0];
                if (!acc[dateKey]) {
                    acc[dateKey] = { totalBlinkCount: 0, totalDurationSec: 0, date: new Date(record.captured_at) };
                }
                acc[dateKey].totalBlinkCount += record.blink_count;
                acc[dateKey].totalDurationSec += record.stare_duration_sec;
                return acc;
            }, {});

            const sortedDays = Object.values(dailyAggregates).sort((a, b) => a.date - b.date);

            if (sortedDays.length > 0) {
                const labels = sortedDays.map(day => day.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }));
                const blinksPerMinute = sortedDays.map(day => 
                    day.totalDurationSec > 0 
                        ? ((day.totalBlinkCount / day.totalDurationSec) * 60).toFixed(2) 
                        : 0
                );

                setDailyData({
                    labels,
                    datasets: [createDataset('Rata-rata Kedipan per Hari', blinksPerMinute, 'rgb(255, 99, 132)')]
                });
            }
        };

        // Fungsi utama yang menjalankan semuanya
        const fetchAndProcessHistory = async () => {
            try {
                const response = await axios.get(`${API_URL}/history`);
                const records = response.data;
                if (!records || records.length === 0) {
                    throw new Error("Belum ada data history.");
                }
                
                processTodayData(records);
                processDailyData(records);

            } catch (err) {
                console.error("Error fetching or processing history:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAndProcessHistory();

        // Karena semua fungsi didefinisikan di dalam, dependency array kosong sudah benar
        // dan tidak akan menimbulkan peringatan lagi.
    }, []); // <-- Dependency array dibiarkan kosong

    const renderChart = (chartData, title) => {
        if (loading) return <Spinner animation="border" />;
        if (!chartData) return <p>Tidak ada data untuk ditampilkan pada periode ini.</p>;
        return <Line options={chartOptions(title)} data={chartData} />;
    };

    return (
        <Container fluid className="p-4">
            <Row className="mb-4">
                <Col>
                    <h2 className="display-6">Selamat Datang di EyeCare 👀</h2>
                    <p className="lead text-muted">Pantau progres kesehatan mata Anda melalui ringkasan data di bawah ini.</p>
                </Col>
            </Row>

            <Tabs defaultActiveKey="today" id="history-tabs" className="mb-3" fill>
                <Tab eventKey="today" title="Aktivitas Hari Ini">
                    <Card className="shadow-sm">
                        <Card.Body>
                            {renderChart(todayData, 'Detail Sesi Hari Ini')}
                        </Card.Body>
                    </Card>
                </Tab>
                <Tab eventKey="daily" title="Grafik Harian">
                     <Card className="shadow-sm">
                        <Card.Body>
                            {renderChart(dailyData, 'Rata-rata Kedipan per Hari (Semua Riwayat)')}
                        </Card.Body>
                    </Card>
                </Tab>
            </Tabs>

             {error && !loading && <p className="text-danger mt-3">Error: {error}</p>}
        </Container>
    );
}

export default Home;
