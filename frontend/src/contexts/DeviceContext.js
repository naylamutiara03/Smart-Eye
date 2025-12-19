import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";
import { supabase } from "../supabaseClient";

const DeviceContext = createContext();

export const useDevice = () => useContext(DeviceContext);

export const DeviceProvider = ({ children }) => {
  const [devices, setDevices] = useState([]);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [user, setUser] = useState(null);
  const [activeDeviceId, setActiveDeviceId] = useState(null); // ID hardware yang terdeteksi otomatis

  const API_URL = "https://smart-eye-n58f.onrender.com"; // Sesuaikan port backend

  // 1. Cek User Session
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchDevices(session.user.id);
      } else {
        setLoading(false);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchDevices(session.user.id);
        } else {
          setUser(null);
          setDevices([]);
          setCurrentDevice(null);
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Fungsi Scan Otomatis (Helper untuk Detect.js & Add Device)
  const autoDetectDevice = async () => {
    try {
      const res = await axios.get(`${API_URL}/stream/latest`);

      if (res.data.status === "online" && res.data.data.hardware_id) {
        const detectedId = res.data.data.hardware_id;
        setActiveDeviceId(detectedId);
        console.log("Device terdeteksi otomatis:", detectedId);
        return detectedId;
      }
      return null;
    } catch (error) {
      // Silent error agar tidak memenuhi console jika offline
      return null;
    }
  };

  // 2. Fetch Devices dari Database
  const fetchDevices = async (userId) => {
    try {
      // Kita ambil langsung dari Supabase agar lebih cepat dan aman
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      const deviceList = data;
      setDevices(deviceList);

      if (deviceList.length > 0) {
        const savedId = localStorage.getItem("selectedDeviceId");
        const found = deviceList.find((d) => d.id.toString() === savedId);
        setCurrentDevice(found || deviceList[0]);
        setShowDeviceModal(false);
      } else {
        setCurrentDevice(null);
        setShowDeviceModal(true);
      }
    } catch (err) {
      console.error("Gagal ambil devices:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Tambah Device Baru (DIPERBAIKI)
  const addDevice = async (deviceName) => {
    if (!user) return false;

    // --- LOGIKA HARDWARE ID ---
    let hardwareIdToUse = null;

    // A. Coba deteksi otomatis dulu
    const detected = await autoDetectDevice();

    if (detected) {
      hardwareIdToUse = detected;
    } else {
      // B. Jika tidak ada kamera terdeteksi, buat ID acak (Fallback)
      hardwareIdToUse =
        "DEV-" + Math.random().toString(36).substr(2, 9).toUpperCase();
      console.log("Menggunakan Random ID:", hardwareIdToUse);
    }

    try {
      // Simpan langsung ke Supabase (Bypass Backend RLS issue)
      const { data, error } = await supabase
        .from("devices")
        .insert([
          {
            user_id: user.id,
            device_name: deviceName,
            is_active: true,
            hardware_id: hardwareIdToUse,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const newDevice = data;

      // Update state lokal
      const newDevicesList = [...devices, newDevice];
      setDevices(newDevicesList);
      setCurrentDevice(newDevice);

      // Simpan ke local storage
      localStorage.setItem("selectedDeviceId", newDevice.id);

      return true;
    } catch (err) {
      console.error("Gagal menambah device:", err.message);
      alert("Gagal menyimpan: " + err.message);
      return false;
    }
  };

  // 4. Ganti Device Selection
  const selectDevice = (deviceId) => {
    const dev = devices.find((d) => d.id.toString() === deviceId.toString());
    if (dev) {
      setCurrentDevice(dev);
      localStorage.setItem("selectedDeviceId", dev.id);
    }
  };

  return (
    <DeviceContext.Provider
      value={{
        devices,
        currentDevice,
        loading,
        addDevice,
        selectDevice,
        showDeviceModal,
        setShowDeviceModal,
        user,
        activeDeviceId,
        autoDetectDevice,
        API_URL,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};
