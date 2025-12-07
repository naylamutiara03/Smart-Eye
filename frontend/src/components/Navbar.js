import React, { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { supabase } from "../supabaseClient";
import "./CardNav.css";
import {
  Home,
  Camera,
  History,
  LogOut,
  Monitor,
  PlusCircle,
} from "lucide-react";
import { useDevice } from "../contexts/DeviceContext";

const CardNavLink = React.forwardRef(
  ({ to, label, icon, onClick, style, className }, ref) => (
    <NavLink
      ref={ref}
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `nav-card navlink-card ${isActive ? "active" : ""} ${className}`
      }
      style={style}
      onClick={onClick}
    >
      <div className="nav-card-label d-flex align-items-center">
        {React.cloneElement(icon, { size: 20, className: "me-2" })}
        {label}
      </div>
    </NavLink>
  )
);

function CardNavbar() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);

  // --- DEVICE LOGIC ---
  const { devices, currentDevice, selectDevice, setShowDeviceModal, user } =
    useDevice();

  const handleDeviceChange = (e) => {
    const val = e.target.value;
    if (val === "ADD_NEW") {
      setShowDeviceModal(true);
    } else {
      selectDevice(val);
    }
  };

  const navItems = [
    {
      to: "/",
      label: "Home",
      icon: <Home />,
      bgColor: "#e0f7fa",
      textColor: "#006064",
    },
    {
      to: "/detect",
      label: "Detect",
      icon: <Camera />,
      bgColor: "#fff3e0",
      textColor: "#e65100",
    },
    {
      to: "/history",
      label: "History",
      icon: <History />,
      bgColor: "#e8f5e9",
      textColor: "#2e7d32",
    },
    {
      to: "/logout",
      label: "Logout",
      icon: <LogOut />,
      bgColor: "#ffebee",
      textColor: "#c62828",
      isLogout: true,
    },
  ];

  const handleLogout = async () => {
    try {
      setShowModal(false);
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Gagal logout:", error.message);
    }
  };

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  // ... (GSAP Animations tetap sama, saya skip untuk ringkas, copy paste logika GSAP sebelumnya) ...
  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 55;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      const topBar = 55;
      const padding = 16;
      const contentHeight = navItems.length * 50 + (navItems.length - 1) * 8;
      return topBar + contentHeight + padding;
    }
    return 260;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;
    gsap.set(navEl, { height: 55, overflow: "hidden" });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });
    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease: "power3.out",
    });
    tl.to(
      cardsRef.current,
      { y: 0, opacity: 1, duration: 0.4, ease: "power3.out", stagger: 0.08 },
      "-=0.1"
    );
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => {
      tl?.kill();
      tlRef.current = null;
    };
  }, [navItems.length]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;
      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded, navItems.length]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      const onReverseComplete = () => {
        setIsExpanded(false);
        tl.eventCallback("onReverseComplete", null);
      };
      setIsHamburgerOpen(false);
      tl.eventCallback("onReverseComplete", onReverseComplete);
      tl.reverse();
    }
  };

  const handleNavLinkClick = () => {
    if (isExpanded) toggleMenu();
  };
  const setCardRef = (i) => (el) => {
    if (el) cardsRef.current[i] = el;
  };

  const Logo = () => (
    <Link to="/" style={{ textDecoration: "none", color: "#111" }}>
      <span className="fw-bold" style={{ fontSize: "1.25rem" }}>
        EyeCare 👁️
      </span>
    </Link>
  );

  return (
    <div className={`card-nav-container`}>
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? "open" : ""}`}
        style={{ backgroundColor: "#fff" }}
      >
        <div className="card-nav-top">
          <div className="logo-container d-flex align-items-center gap-3">
            <Logo />

            {/* --- DEVICE SELECTOR (Desktop/Mobile visible) --- */}
            {user && (
              <div className="d-flex align-items-center bg-light rounded px-2 py-1 border">
                <Monitor
                  size={16}
                  className="text-secondary me-2 d-none d-sm-block"
                />
                <select
                  className="form-select form-select-sm border-0 bg-transparent shadow-none p-0 pe-3"
                  style={{
                    maxWidth: "120px",
                    fontWeight: "500",
                    fontSize: "0.85rem",
                  }}
                  value={currentDevice?.id || ""}
                  onChange={handleDeviceChange}
                >
                  <option value="" disabled>
                    Pilih Perangkat
                  </option>
                  {devices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.device_name}
                    </option>
                  ))}
                  <option value="ADD_NEW" className="fw-bold text-primary">
                    + Tambah Baru
                  </option>
                </select>
              </div>
            )}
          </div>

          <div
            className={`hamburger-menu ${isHamburgerOpen ? "open" : ""}`}
            onClick={toggleMenu}
            style={{ color: "#111" }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {navItems.map((item, idx) =>
            item.isLogout ? (
              <div
                key="logout"
                ref={setCardRef(idx)}
                className="nav-card navlink-card"
                style={{ backgroundColor: item.bgColor, color: item.textColor }}
                onClick={openModal}
              >
                <div className="nav-card-label d-flex align-items-center">
                  {React.cloneElement(item.icon, {
                    size: 20,
                    className: "me-2",
                  })}
                  {item.label}
                </div>
              </div>
            ) : (
              <CardNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                ref={setCardRef(idx)}
                style={{ backgroundColor: item.bgColor, color: item.textColor }}
                onClick={handleNavLinkClick}
              />
            )
          )}
        </div>
      </nav>

      {/* Logout Modal */}
      {showModal && (
        <div
          className="position-fixed top-50 start-50 translate-middle"
          style={{ zIndex: 1055, minWidth: "320px" }}
        >
          <div className="card shadow border-0">
            <div className="card-header bg-danger text-white fw-bold">
              Konfirmasi Logout
            </div>
            <div className="card-body">
              <p className="mb-3">Apakah kamu yakin ingin logout?</p>
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
    </div>
  );
}

export default CardNavbar;
