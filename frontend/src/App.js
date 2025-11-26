// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Detect from './pages/Detect';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import UpdatePassword from './pages/UpdatePassword';

function AppContent() {
  const location = useLocation();

  // daftar halaman yang tidak menampilkan navbar
  const hideNavbarRoutes = ['/login', '/register', '/update-password'];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {!shouldHideNavbar && (
        // --- MODIFIKASI DI SINI ---
        // Kita bungkus Navbar dengan div sticky agar menempel di atas
        <div style={{ position: 'sticky', top: 0, zIndex: 1000, width: '100%' }}>
          <Navbar />
        </div>
      )}

      {/* Catatan: Karena Navbar sekarang sticky, pastikan konten main 
        memiliki margin yang cukup agar rapi. class 'mt-4' sudah cukup baik.
      */}
      <main className={`${shouldHideNavbar ? '' : 'container mt-4'}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/" element={<Home />} />
          <Route path="/detect" element={<Detect />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;