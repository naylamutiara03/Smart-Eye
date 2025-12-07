import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Detect from "./pages/Detect";
import History from "./pages/History";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UpdatePassword from "./pages/UpdatePassword";
import { DeviceProvider } from "./contexts/DeviceContext";
import DeviceModal from "./components/DeviceModal";

function AppContent() {
  const location = useLocation();
  const hideNavbarRoutes = ["/login", "/register", "/update-password"];
  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {/* Modal Device Global */}
      <DeviceModal />

      {!shouldHideNavbar && (
        <div
          style={{ position: "sticky", top: 0, zIndex: 1000, width: "100%" }}
        >
          <Navbar />
        </div>
      )}

      <main className={`${shouldHideNavbar ? "" : "container mt-4"}`}>
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
    <DeviceProvider>
      <Router>
        <AppContent />
      </Router>
    </DeviceProvider>
  );
}

export default App;
