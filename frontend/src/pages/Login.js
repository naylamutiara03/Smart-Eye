import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, Mail } from 'lucide-react';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // State baru untuk pesan sukses
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false); // State untuk mengaktifkan mode reset
  const [resetEmail, setResetEmail] = useState(''); // State untuk email reset
  const navigate = useNavigate();

  // --- FUNGSI LOGIN UTAMA ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        if (loginError.message.toLowerCase().includes('invalid')) {
          setError('Email atau password salah.');
        } else if (loginError.message.toLowerCase().includes('email not confirmed')) {
          setError('Email belum diverifikasi. Silakan cek kotak masuk Anda.');
        } else {
          setError('Terjadi kesalahan: ' + loginError.message);
        }
        return;
      }

      if (data?.user) {
        navigate('/');
      } else {
        setError('Login gagal. Silakan coba lagi.');
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan saat mencoba login.');
    } finally {
      setLoading(false);
    }
  };

  // --- FUNGSI LUPA PASSWORD ---
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Menggunakan resetPasswordForEmail untuk mengirim link reset
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        // Opsional: Tentukan halaman kemana user akan diarahkan setelah klik link di email
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess('Link reset password telah dikirim ke email Anda. Silakan cek kotak masuk.');
      // Kembali ke mode login setelah sukses
      setTimeout(() => setIsResetting(false), 3000);

    } catch (err) {
      console.error("Error reset password:", err);
      setError('Terjadi kesalahan saat meminta reset password.');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER KOMPONEN ---
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg border-0 rounded-4 p-4" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="text-center mb-4">
          <Eye size={48} className="text-primary mb-2" />
          <h1 className="fw-bold text-dark">Smart-Eye</h1>
          <p className="text-muted mb-0">{isResetting ? 'Reset Password Anda' : 'Masuk ke akun Anda untuk melanjutkan'}</p>
        </div>

        {error && <div className="alert alert-danger text-center py-2">{error}</div>}
        {success && <div className="alert alert-success text-center py-2">{success}</div>}

        {/* FORM LOGIN */}
        {!isResetting ? (
          <form onSubmit={handleLogin}>
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
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* LINK LUPA PASSWORD */}
            <div className="d-flex justify-content-end mb-4">
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none text-muted"
                onClick={() => {
                  setIsResetting(true);
                  setError(''); // Bersihkan error saat beralih mode
                  setSuccess('');
                }}
                disabled={loading}
              >
                Lupa Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-100 d-flex justify-content-center align-items-center py-2"
            >
              {loading ? (
                <>
                  <div className="spinner-border spinner-border-sm me-2" role="status" />
                  Memproses...
                </>
              ) : (
                <>
                  <LogIn className="me-2" size={18} /> Masuk
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordReset}>
            {/* FORM RESET PASSWORD */}
            <p className="text-muted text-center small mb-3">Masukkan email yang terdaftar. Kami akan mengirimkan tautan reset.</p>
            <div className="mb-4">
              <label htmlFor="resetEmail" className="form-label fw-semibold">Email</label>
              <input
                type="email"
                id="resetEmail"
                className="form-control form-control-lg"
                placeholder="nama@contoh.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-warning w-100 d-flex justify-content-center align-items-center py-2"
            >
              {loading ? (
                <>
                  <div className="spinner-border spinner-border-sm me-2" role="status" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Mail className="me-2" size={18} /> Kirim Tautan Reset
                </>
              )}
            </button>

            <div className="text-center mt-3">
              <button
                type="button"
                className="btn btn-link p-0 text-decoration-none"
                onClick={() => {
                  setIsResetting(false);
                  setError(''); // Bersihkan error saat beralih mode
                  setSuccess('');
                }}
                disabled={loading}
              >
                Kembali ke Halaman Login
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-4">
          <p className="text-muted">
            Belum punya akun?{' '}
            <Link to="/register" className="text-primary fw-semibold text-decoration-none">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;