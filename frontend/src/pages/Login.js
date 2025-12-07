// frontend/src/pages/Login.js
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, Eye, Mail, AlertCircle } from "lucide-react";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const navigate = useNavigate();

  // --- FUNGSI LOGIN UTAMA ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        if (loginError.message.toLowerCase().includes("invalid")) {
          setError("Email atau password salah.");
        } else if (
          loginError.message.toLowerCase().includes("email not confirmed")
        ) {
          setError("Email belum diverifikasi. Silakan cek kotak masuk Anda.");
        } else {
          setError("Terjadi kesalahan: " + loginError.message);
        }
        return;
      }

      if (data?.user) {
        navigate("/");
      } else {
        setError("Login gagal. Silakan coba lagi.");
      }
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan saat mencoba login.");
    } finally {
      setLoading(false);
    }
  };

  // --- FUNGSI LUPA PASSWORD DENGAN PENGECEKAN EMAIL ---
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // 1. Cek apakah email ada di database menggunakan RPC (Remote Procedure Call)
      // Pastikan Anda sudah menjalankan SQL 'check_email_exists' di Supabase Editor
      const { data: emailExists, error: rpcError } = await supabase.rpc(
        "check_email_exists",
        { email_arg: resetEmail }
      );

      if (rpcError) {
        console.error("RPC Error:", rpcError);
        // Jika fungsi SQL belum dibuat, fallback ke error umum atau lanjut kirim (opsional)
        setError("Gagal memverifikasi email. Pastikan koneksi aman.");
        setLoading(false);
        return;
      }

      // 2. Jika email TIDAK ada (return false), tampilkan peringatan
      if (!emailExists) {
        setError(
          "Email tidak terdaftar dalam sistem kami. Silakan daftar terlebih dahulu."
        );
        setLoading(false);
        return;
      }

      // 3. Jika email ADA, lanjutkan kirim link reset password
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        resetEmail,
        {
          redirectTo: `${window.location.origin}/update-password`,
        }
      );

      if (resetError) {
        setError(
          "Gagal mengirim tautan reset. Pesan error: " + resetError.message
        );
        return;
      }

      setSuccess(
        "Email terdaftar! Tautan reset password telah dikirim ke kotak masuk Anda."
      );

      // Kembali ke mode login setelah sukses (opsional, diberi delay)
      // setTimeout(() => setIsResetting(false), 5000);
    } catch (err) {
      console.error("Error reset password:", err);
      setError("Terjadi kesalahan tak terduga.");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER KOMPONEN ---
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div
        className="card shadow-lg border-0 rounded-4 p-4"
        style={{ maxWidth: "420px", width: "100%" }}
      >
        <div className="text-center mb-4">
          <Eye size={48} className="text-primary mb-2" />
          <h1 className="fw-bold text-dark">Smart-Eye</h1>
          <p className="text-muted mb-0">
            {isResetting
              ? "Reset Password Anda"
              : "Masuk ke akun Anda untuk melanjutkan"}
          </p>
        </div>

        {error && (
          <div className="alert alert-danger text-center py-2 d-flex align-items-center justify-content-center">
            <AlertCircle size={18} className="me-2" />
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success text-center py-2">{success}</div>
        )}

        {/* FORM LOGIN */}
        {!isResetting ? (
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label fw-semibold">
                Email
              </label>
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
              <label htmlFor="password" className="form-label fw-semibold">
                Password
              </label>
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
                  setError("");
                  setSuccess("");
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
                  <div
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  />
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
            <p className="text-muted text-center small mb-3">
              Masukkan email Anda untuk menerima tautan reset password.
            </p>
            <div className="mb-4">
              <label htmlFor="resetEmail" className="form-label fw-semibold">
                Email
              </label>
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
                  <div
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  />
                  Mengecek Email...
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
                  setError("");
                  setSuccess("");
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
            Belum punya akun?{" "}
            <Link
              to="/register"
              className="text-primary fw-semibold text-decoration-none"
            >
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
