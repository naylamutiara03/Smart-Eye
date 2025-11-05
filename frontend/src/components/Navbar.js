import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Navbar() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const handleLogout = async () => {
    try {
      // Tutup modal lebih dulu agar hilang sebelum navigate
      setShowModal(false);
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Gagal logout:', error.message);
    }
  };

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  return (
    <>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div className="container-fluid">
          <Link className="navbar-brand fw-bold" to="/">
            EyeCare 👁️
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
              <li className="nav-item">
                <NavLink className="nav-link" to="/">Home</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/detect">Deteksi</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/history">History</NavLink>
              </li>

              <li className="nav-item ms-lg-3 mt-2 mt-lg-0">
                <button
                  className="btn btn-outline-light btn-sm px-3"
                  onClick={openModal}
                >
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Modal konfirmasi logout (tanpa overlay) */}
      {showModal && (
        <div
          className="position-fixed top-50 start-50 translate-middle"
          style={{ zIndex: 1055, minWidth: '320px' }}
        >
          <div className="card shadow border-0">
            <div className="card-header bg-danger text-white fw-bold">
              Konfirmasi Logout
            </div>
            <div className="card-body">
              <p className="mb-3">Apakah kamu yakin ingin logout dari akun ini?</p>
              <div className="d-flex justify-content-end gap-2">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={closeModal}
                >
                  Batal
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleLogout}
                >
                  Ya, Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
