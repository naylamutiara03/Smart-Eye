import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Key } from 'lucide-react';

function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Pastikan user datang dari link reset Supabase
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError('Link reset password sudah kadaluarsa atau tidak valid.');
      }
    });
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!password || !confirmPassword) {
      setError('Silakan isi semua field.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi tidak cocok.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess('Password berhasil diperbarui! Anda akan diarahkan ke login...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      console.error('Error updating password:', err);
      setError('Terjadi kesalahan saat memperbarui password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card shadow-lg border-0 rounded-4 p-4" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="text-center mb-4">
          <Key size={48} className="text-warning mb-2" />
          <h1 className="fw-bold text-dark">Update Password</h1>
          <p className="text-muted mb-0">Masukkan password baru Anda</p>
        </div>

        {error && <div className="alert alert-danger text-center py-2">{error}</div>}
        {success && <div className="alert alert-success text-center py-2">{success}</div>}

        {!error && (
          <form onSubmit={handleUpdatePassword}>
            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-semibold">Password Baru</label>
              <input
                type="password"
                id="password"
                className="form-control form-control-lg"
                placeholder="Masukkan password baru"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="confirmPassword" className="form-label fw-semibold">Konfirmasi Password</label>
              <input
                type="password"
                id="confirmPassword"
                className="form-control form-control-lg"
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-warning w-100 d-flex justify-content-center align-items-center py-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner-border spinner-border-sm me-2" role="status" />
                  Memperbarui...
                </>
              ) : (
                <>Update Password</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default UpdatePassword;
