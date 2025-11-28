import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { supabase } from '../supabaseClient';
import './CardNav.css'; // Import CSS yang telah diubah

// 1. IMPOR IKON BARU DARI LUCIDE-REACT
import { Home, Camera, History, LogOut } from 'lucide-react'; 

// ===============================================
// Komponen CardNav yang Diadaptasi
// ===============================================

// Menggunakan NavLink untuk navigasi di dalam kartu
const CardNavLink = React.forwardRef(({ to, label, icon, onClick, style, className }, ref) => (
  <NavLink
    ref={ref}
    to={to}
    // Tambahkan properti end agar hanya aktif pada root path-nya
    end={to === "/"}
    className={({ isActive }) => `nav-card navlink-card ${isActive ? 'active' : ''} ${className}`}
    style={style}
    onClick={onClick}
  >
    <div className="nav-card-label d-flex align-items-center"> {/* Tambah d-flex untuk menyelaraskan ikon */}
      {/* RENDER IKON DI SINI */}
      {React.cloneElement(icon, { size: 20, className: "me-2" })} 
      {label}
    </div>
  </NavLink>
));

function CardNavbar() {
  const navigate = useNavigate();
  // Karena tombol logout card dihapus, modal ini hanya dipicu oleh tombol CTA desktop
  const [showModal, setShowModal] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef(null);

  // Sekarang hanya ada 3 link utama (Home, Deteksi, History)
  const cardsRef = useRef([]);
  const tlRef = useRef(null);

  // 2. DATA NAVIGASI UTAMA (TAMBAHKAN PROPERTI ICON)
  const navItems = [
    { to: '/', label: 'Home', icon: <Home />, bgColor: '#e0f7fa', textColor: '#006064' },
    { to: '/detect', label: 'Detect', icon: <Camera />, bgColor: '#fff3e0', textColor: '#e65100' },
    { to: '/history', label: 'History', icon: <History />, bgColor: '#e8f5e9', textColor: '#2e7d32' },
    { to: '/logout', label: 'Logout', icon: <LogOut />, bgColor: '#ffebee', textColor: '#c62828', isLogout: true }
  ];


  // --- LOGIC MODAL & LOGOUT ---
  const handleLogout = async () => {
    try {
      setShowModal(false);
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Gagal logout:', error.message);
    }
  };

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  // --- LOGIC GSAP ANIMATION ---
  // ... (calculateHeight, createTimeline, useLayoutEffect, useLayoutEffect resize remain the same) ...

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 55; // Ubah tinggi default

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      // Hitung ulang tinggi untuk mobile
      const topBar = 55; // Tinggi nav-top baru
      const padding = 16;

      // Hitungan tinggi card mobile: (4 item * 50px) + (3 gap * 8px) = 200 + 24 = 224px
      // Menggunakan navItems.length yang sekarang 4
      const contentHeight = (navItems.length * 50) + ((navItems.length - 1) * 8); 

      return topBar + contentHeight + padding;
    }
    // Tinggi saat expanded di desktop (Tetap 260 jika design kartu diinginkan besar)
    return 260;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    // Ubah tinggi awal menjadi 55px
    gsap.set(navEl, { height: 55, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease: 'power3.out'
    });

    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.08 }, '-=0.1');

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navItems.length]); // Tambahkan dependensi navItems.length agar timeline diperbarui saat item berubah

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

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        tl.eventCallback('onReverseComplete', null);
      };

      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', onReverseComplete);
      tl.reverse();
    }
  };

  const handleNavLinkClick = () => {
    // Tutup menu setelah navigasi di NavLink
    if (isExpanded) {
      toggleMenu();
    }
  };

  const setCardRef = i => el => {
    // Pastikan hanya item dari navItems yang mendapatkan ref
    if (el) cardsRef.current[i] = el;
  };

  const Logo = () => (
    <Link to="/" style={{ textDecoration: 'none', color: '#111' }}>
      <span className="fw-bold" style={{ fontSize: '1.25rem' }}>
        EyeCare 👁️
      </span>
    </Link>
  );

  return (
    // Tambahkan padding-top di komponen utama Anda agar konten tidak tertutup navbar fixed
    <div className={`card-nav-container`}>
      {/* Navbar Utama */}
      <nav ref={navRef} className={`card-nav ${isExpanded ? 'open' : ''}`} style={{ backgroundColor: '#fff' }}>
        <div className="card-nav-top">

          <div className="logo-container">
            <Logo />
          </div>

          {/* Hamburger Menu (Mobile Only) */}
          <div
            className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
            onClick={toggleMenu}
            role="button"
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            tabIndex={0}
            style={{ color: '#111' }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>
        </div>

        {/* Konten Menu/Card Navigasi */}
        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {navItems.map((item, idx) => (
            item.isLogout ? (
              // 4. PERBARUI ITEM LOGOUT DENGAN IKON
              <div
                key="logout"
                ref={setCardRef(idx)}
                className="nav-card navlink-card"
                style={{ backgroundColor: item.bgColor, color: item.textColor }}
                onClick={openModal}
              >
                <div className="nav-card-label d-flex align-items-center">
                  {React.cloneElement(item.icon, { size: 20, className: "me-2" })}
                  {item.label}
                </div>
              </div>
            ) : (
              <CardNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon} // Meneruskan ikon
                ref={setCardRef(idx)}
                style={{ backgroundColor: item.bgColor, color: item.textColor }}
                onClick={handleNavLinkClick}
              />
            )
          ))}
          {/* Tambahkan card Logout untuk Mobile saja jika diperlukan, 
          	 namun karena Anda bilang sudah ada di luar, kita biarkan hanya 3 item */}
        </div>
      </nav>

      {/* Modal konfirmasi logout */}
      {showModal && (
        <div
          className="position-fixed top-50 start-50 translate-middle"
          style={{ zIndex: 1055, minWidth: '320px' }}
        >
          <div className="card shadow border-0">
            <div className="card-header bg-danger text-white fw-bold">
              Konfirmasi Logout
            </div>
            <div className="card-body">
              <p className="mb-3">Apakah kamu yakin ingin logout dari akun ini?</p>
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