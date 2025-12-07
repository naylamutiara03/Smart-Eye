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

  const API_URL = "http://127.0.0.1:5000"; // Sesuaikan port backend

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

  // 2. Fetch Devices dari Backend
  const fetchDevices = async (userId) => {
    try {
      const res = await axios.get(`${API_URL}/devices`, {
        params: { user_id: userId },
      });
      const deviceList = res.data;

      setDevices(deviceList);

      if (deviceList.length > 0) {
        // Jika ada device, pilih yang pertama sebagai default (atau dari localstorage)
        const savedId = localStorage.getItem("selectedDeviceId");
        const found = deviceList.find((d) => d.id.toString() === savedId);
        setCurrentDevice(found || deviceList[0]);
        setShowDeviceModal(false);
      } else {
        // Jika TIDAK ADA device, WAJIBKAN muncul modal
        setCurrentDevice(null);
        setShowDeviceModal(true);
      }
    } catch (err) {
      console.error("Gagal ambil devices:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Tambah Device Baru
  const addDevice = async (deviceName) => {
    if (!user) return;
    try {
      const res = await axios.post(`${API_URL}/devices`, {
        user_id: user.id,
        device_name: deviceName,
      });
      const newDevice = res.data;

      const newDevicesList = [...devices, newDevice];
      setDevices(newDevicesList);
      setCurrentDevice(newDevice); // Auto select yang baru

      // Simpan ke local storage
      localStorage.setItem("selectedDeviceId", newDevice.id);

      return true;
    } catch (err) {
      console.error(err);
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
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};
