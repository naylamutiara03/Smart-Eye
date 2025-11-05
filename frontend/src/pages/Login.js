import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye } from 'lucide-react'; // pastikan lucide-react sudah diinstall

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('Email atau password salah.');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mencoba login. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg border-0 rounded-4 p-4" style={{ maxWidth: '420px', width: '100%' }}>
        
        {/* Header */}
        <div className="text-center mb-4">
          <Eye size={48} className="text-primary mb-2" />
          <h1 className="fw-bold text-dark">Smart-Eye</h1>
          <p className="text-muted mb-0">Masuk ke akun Anda untuk melanjutkan</p>
        </div>

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
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="alert alert-danger text-center py-2">{error}</div>
          )}

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
