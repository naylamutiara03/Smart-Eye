// Register.js

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Eye } from 'lucide-react';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 🔹 Validasi awal
    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak sama.');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    setLoading(true);

    try {
      // 🔹 Cek apakah email sudah digunakan (query langsung ke auth.users)
      const { data: existingUser, error: checkError } = await supabase
        .from('auth_emails')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (checkError) console.warn('Warning saat cek email:', checkError.message);

      if (existingUser) {
        setError('Email sudah digunakan. Silakan login atau gunakan email lain.');
        setLoading(false);
        return;
      }

      // 🔹 Sign up user baru
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      // Handle jika Supabase mengembalikan error
      if (signUpError) {
        if (
          signUpError.message.toLowerCase().includes('exists') ||
          signUpError.message.toLowerCase().includes('already')
        ) {
          setError('Email sudah digunakan. Silakan login atau gunakan email lain.');
        } else {
          setError('Terjadi kesalahan saat registrasi: ' + signUpError.message);
        }
        return;
      }

      // 🔹 Jika berhasil (user baru dibuat)
      if (data?.user) {
        setSuccess('Registrasi berhasil! Silakan cek email Anda untuk verifikasi.');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError('Registrasi gagal. Silakan coba lagi.');
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan tak terduga saat registrasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg border-0 rounded-4 p-4" style={{ maxWidth: '450px', width: '100%' }}>
        <div className="text-center mb-4">
          <Eye size={48} className="text-primary mb-2" />
          <h1 className="fw-bold text-dark">Smart-Eye</h1>
          <p className="text-muted mb-0">Buat akun baru untuk memulai</p>
        </div>

        <form onSubmit={handleRegister}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label fw-semibold">Email</label>
            <input
              type="email"
              id="email"
              className="form-control form-control-lg"
              placeholder="nama@contoh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label fw-semibold">Password</label>
            <input
              type="password"
              id="password"
              className="form-control form-control-lg"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label fw-semibold">Konfirmasi Password</label>
            <input
              type="password"
              id="confirmPassword"
              className="form-control form-control-lg"
              placeholder="Ulangi password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <div className="alert alert-danger text-center py-2">{error}</div>}
          {success && <div className="alert alert-success text-center py-2">{success}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-success w-100 d-flex justify-content-center align-items-center py-2"
          >
            {loading ? (
              <>
                <div className="spinner-border spinner-border-sm me-2" role="status" />
                Mendaftarkan...
              </>
            ) : (
              <>
                <UserPlus className="me-2" size={18} /> Daftar
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-4">
          <p className="text-muted">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-success fw-semibold text-decoration-none">
              Masuk sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
