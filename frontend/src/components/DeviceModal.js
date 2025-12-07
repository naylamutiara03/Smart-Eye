import React, { useState } from "react";
import { useDevice } from "../contexts/DeviceContext";
import { Monitor, Save } from "lucide-react";

function DeviceModal() {
  const { showDeviceModal, setShowDeviceModal, addDevice, devices, loading } =
    useDevice();
  const [deviceName, setDeviceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Jika loading atau tidak disuruh tampil, jangan render
  if (loading || !showDeviceModal) return null;

  // Jika belum punya device sama sekali, user GABOLEH tutup modal (force)
  const canClose = devices.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deviceName.trim()) return;

    setIsSubmitting(true);
    const success = await addDevice(deviceName);
    setIsSubmitting(false);

    if (success) {
      setDeviceName("");
      setShowDeviceModal(false);
    }
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 2000 }}
    >
      <div
        className="card shadow-lg border-0 rounded-4"
        style={{ width: "90%", maxWidth: "400px" }}
      >
        <div className="card-header bg-primary text-white text-center py-3">
          <Monitor size={32} className="mb-2" />
          <h5 className="mb-0 fw-bold">
            {devices.length === 0
              ? "Registrasi Kamera Wajib"
              : "Tambah Perangkat Baru"}
          </h5>
        </div>

        <div className="card-body p-4">
          {devices.length === 0 && (
            <div className="alert alert-warning text-small">
              Anda belum memiliki perangkat terdaftar. Silakan daftarkan nama
              kamera/laptop Anda untuk melanjutkan.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Nama Perangkat</label>
              <input
                type="text"
                className="form-control form-control-lg"
                placeholder="Contoh: Laptop Kantor, Webcam Logitech"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="d-flex gap-2 mt-4">
              {canClose && (
                <button
                  type="button"
                  className="btn btn-light flex-fill"
                  onClick={() => setShowDeviceModal(false)}
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary flex-fill fw-bold"
                disabled={isSubmitting || !deviceName.trim()}
              >
                {isSubmitting ? (
                  "Menyimpan..."
                ) : (
                  <>
                    <Save size={18} className="me-2" /> Simpan Perangkat
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default DeviceModal;
