import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./MobileAd.css";

const AD_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const SKIP_DELAY_MS = 5000; // can skip after 5 s

const MobileAd = () => {
  const [visible, setVisible] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Only show on mobile viewport
    if (window.innerWidth > 768) return;

    const last = parseInt(localStorage.getItem("ad_last_shown") || "0", 10);
    if (Date.now() - last >= AD_COOLDOWN_MS) {
      setVisible(true);
      // allow skip after SKIP_DELAY_MS
      timerRef.current = setTimeout(() => setCanSkip(true), SKIP_DELAY_MS);
      // countdown display
      let c = 5;
      countdownRef.current = setInterval(() => {
        c -= 1;
        setCountdown(c);
        if (c <= 0) clearInterval(countdownRef.current);
      }, 1000);
    }

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem("ad_last_shown", Date.now().toString());
    setVisible(false);
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);
  };

  const handleCTA = () => {
    dismiss();
    navigate("/payment", {
      state: { packageId: "premium-1-month" },
    });
  };

  if (!visible) return null;

  return (
    <div className="mobile-ad-overlay">
      <div className="mobile-ad-card">
        {/* Skip button */}
        <div className="mobile-ad-skip-row">
          {canSkip ? (
            <button className="mobile-ad-skip-btn" onClick={dismiss}>
              Bỏ qua ✕
            </button>
          ) : (
            <span className="mobile-ad-countdown">Bỏ qua sau {countdown}s</span>
          )}
        </div>

        {/* Ad label */}
        <span className="mobile-ad-label">Quảng cáo</span>

        {/* Ad content */}
        <div className="mobile-ad-body">
          <div className="mobile-ad-icon">
            <svg
              width="38"
              height="38"
              viewBox="0 0 256 256"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              stroke="white"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <g transform="translate(-20, 0)">
                <path d="M208 48c-72 4-124 38-136 88-6 26 4 52 28 68 26 18 61 20 92 5 34-17 53-53 52-95-1-23-6-45-15-66-7 0-14 0-21 0z" />
                <path d="M64 160c30-12 64-36 96-80" />
              </g>
            </svg>
          </div>
          <h2 className="mobile-ad-title">GreenPath Premium</h2>
          <p className="mobile-ad-subtitle">
            Mở khóa lộ trình ăn chay cá nhân hóa, công thức độc quyền &amp; phân
            tích dinh dưỡng chuyên sâu.
          </p>

          <ul className="mobile-ad-perks">
            <li>
              <span className="ad-check">✓</span> Lộ trình ăn chay cá nhân hóa
            </li>
            <li>
              <span className="ad-check">✓</span> Công thức từ chuyên gia
            </li>
            <li>
              <span className="ad-check">✓</span> Tắt quảng cáo
            </li>
          </ul>

          <div className="mobile-ad-price-row">
            <span className="mobile-ad-price">69.000đ</span>
            <span className="mobile-ad-period">/ tháng</span>
          </div>

          <button className="mobile-ad-cta" onClick={handleCTA}>
            Nâng cấp ngay →
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileAd;
