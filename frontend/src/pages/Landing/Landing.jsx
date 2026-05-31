import { useContext } from "react";
import { Link } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import "./Landing.css";

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
    ),
    title: "AI cá nhân hóa thực đơn",
    desc: "Thuật toán AI phân tích mục tiêu, sức khỏe và sở thích để tạo thực đơn riêng cho bạn mỗi ngày.",
    accent: "#16a34a", bg: "#f0fdf4",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-6"/>
      </svg>
    ),
    title: "Theo dõi dinh dưỡng",
    desc: "Dashboard trực quan theo dõi kcal, protein, chất béo, carb, chất xơ mỗi ngày.",
    accent: "#2563eb", bg: "#eff6ff",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
    title: "Thư viện công thức Việt",
    desc: "100+ công thức chay Việt Nam dễ làm với nguyên liệu quen thuộc và hướng dẫn chi tiết từng bước.",
    accent: "#d97706", bg: "#fffbeb",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    title: "Nhắc nhở thông minh",
    desc: "Thông báo đúng lúc nhắc bạn không bỏ lỡ bữa ăn và duy trì streak sức khỏe hàng ngày.",
    accent: "#7c3aed", bg: "#f5f3ff",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: "Cộng đồng ăn chay",
    desc: "Kết nối với người cùng hành trình, chia sẻ kinh nghiệm và công thức độc đáo.",
    accent: "#db2777", bg: "#fdf2f8",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "Theo dõi tiến trình",
    desc: "Ghi nhận cân nặng, chỉ số sức khỏe và phân tích xu hướng dài hạn trên dashboard cá nhân.",
    accent: "#0891b2", bg: "#ecfeff",
  },
];

const STEPS = [
  {
    num: "01",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    title: "Tạo hồ sơ sức khỏe",
    desc: "Trả lời 7 câu hỏi về mục tiêu, thể trạng và thói quen ăn uống của bạn.",
  },
  {
    num: "02",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        <path d="M20 3v4"/><path d="M22 5h-4"/>
      </svg>
    ),
    title: "Nhận lộ trình cá nhân",
    desc: "AI tạo thực đơn tối ưu dựa trên hồ sơ của bạn, có thể tùy chỉnh bất kỳ lúc nào.",
  },
  {
    num: "03",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "Theo dõi & Phát triển",
    desc: "Ghi nhận tiến độ hàng ngày, điều chỉnh kế hoạch và đạt mục tiêu sức khỏe bền vững.",
  },
];

const TESTIMONIALS = [
  {
    name: "Nguyễn Thị Lan", role: "Giáo viên · Hà Nội", initials: "NL",
    color: "#f0fdf4", border: "#bbf7d0",
    text: "GreenPath thay đổi hoàn toàn cách mình ăn chay. Trước đây không biết phối hợp thực phẩm đủ dinh dưỡng, bây giờ AI lo hết rồi!",
  },
  {
    name: "Trần Minh Khoa", role: "Kỹ sư phần mềm · TP.HCM", initials: "MK",
    color: "#eff6ff", border: "#bfdbfe",
    text: "App theo dõi protein hàng ngày rất chính xác. Sau 3 tháng cân nặng giảm 5kg và cảm thấy khỏe hơn nhiều, không hề mệt mỏi.",
  },
  {
    name: "Lê Thu Hằng", role: "Blogger sức khỏe · Đà Nẵng", initials: "TH",
    color: "#fffbeb", border: "#fde68a",
    text: "Cộng đồng GreenPath cực kỳ nhiệt tình. Công thức Việt Nam rất gần gũi, dễ nấu với nguyên liệu tại chợ địa phương.",
  },
];

const Landing = () => {
  const { setShowLogin } = useContext(StoreContext);
  const handleSignUp = () => setShowLogin({ show: true, mode: "signup" });
  const handleLogin = () => setShowLogin({ show: true, mode: "login" });

  return (
    <div className="landing-page">

      {/* Mobile Splash */}
      <section className="mobile-landing-splash">
        <div className="mobile-splash-content">
          <div className="mobile-splash-logo"><img src="/logo.png" alt="GreenPath" /></div>
          <h1 className="mobile-splash-title">GreenPath</h1>
          <p className="mobile-splash-description">Ăn chay thông minh hơn, khỏe mạnh hơn mỗi ngày.</p>
          <div className="mobile-splash-actions">
            <button className="mobile-signup-btn" onClick={handleSignUp}>Bắt đầu miễn phí</button>
            <button className="mobile-login-btn" onClick={handleLogin}>Đăng nhập</button>
          </div>
        </div>
      </section>

      {/* Header */}
      <header className="landing-header">
        <div className="container landing-header-inner">
          <Link to="/" className="logo-link logo-section" aria-label="Về trang chủ GreenPath">
            <div className="logo-icon"><img src="/logo.png" alt="GreenPath" /></div>
            <h2 className="logo-text">GreenPath</h2>
          </Link>
          <div className="header-buttons">
            <button className="login-btn" onClick={handleLogin}>Đăng nhập</button>
            <button className="signup-btn" onClick={handleSignUp}>Đăng ký</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-content">
            <h1 className="hero-title">
              Ăn chay <span className="highlight">thông minh</span> hơn,<span className="highlight"> khỏe mạnh</span> hơn mỗi ngày
            </h1>
            <p className="hero-description">
              GreenPath cá nhân hóa lộ trình ăn chay theo sức khỏe của bạn — từ thực đơn AI, theo dõi dinh dưỡng đến 100+ công thức Việt Nam thuần chay.
            </p>
            <div className="hero-ctas">
              <button className="hero-cta-primary" onClick={handleSignUp}>
                Bắt đầu miễn phí
                
              </button>
              <button className="hero-cta-secondary" onClick={() => document.getElementById("how-it-works").scrollIntoView({ behavior: "smooth" })}>
                Xem cách hoạt động
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-mockup">
              <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&q=80" alt="Healthy vegan bowl" className="hero-img" />
              <div className="float-card float-card-meal">
                <span className="float-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>
                    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                  </svg>
                </span>
                <div><p className="float-title">Bữa trưa hôm nay</p><p className="float-sub">Cơm gạo lứt + đậu phụ sốt nấm</p></div>
              </div>
              <div className="float-card float-card-streak">
                <span className="float-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                  </svg>
                </span>
                <div><p className="float-title">Streak</p><p className="float-sub">21 ngày liên tiếp</p></div>
              </div>
              <div className="float-card float-card-nutri">
                <svg viewBox="0 0 44 44" width="44" height="44" className="ring-svg">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4"/>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#16a34a" strokeWidth="4" strokeDasharray="94 113" strokeLinecap="round" transform="rotate(-90 22 22)"/>
                  <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="700" fill="#111827">83%</text>
                </svg>
                <div><p className="float-title">Dinh dưỡng</p><p className="float-sub">Đạt 83% hôm nay</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Tính năng</span>
            <h2 className="section-title">Mọi thứ bạn cần để ăn chay đúng cách</h2>
            <p className="section-sub">Công nghệ AI kết hợp hiểu biết văn hóa ẩm thực Việt Nam tạo ra trải nghiệm ăn chay hoàn toàn mới</p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon-wrap" style={{ background: f.bg, color: f.accent }}>{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Cách hoạt động</span>
            <h2 className="section-title">Bắt đầu trong 3 bước đơn giản</h2>
            <p className="section-sub">Không cần kiến thức dinh dưỡng chuyên sâu — GreenPath lo hết cho bạn</p>
          </div>
          <div className="steps-grid">
            {STEPS.map((s, i) => (
              <div className="step-card" key={i}>
                <div className="step-num-wrap">
                  <div className="step-num">{s.num}</div>
                  {i < STEPS.length - 1 && <div className="step-line" />}
                </div>
                <div className="step-body">
                  <div className="step-icon-wrap">{s.icon}</div>
                  <h3 className="step-title">{s.title}</h3>
                  <p className="step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sustainability */}
      <section className="sustainability-section">
        <div className="container">
          <div className="sustainability-grid">
            <div className="sustainability-content">
              <span className="section-tag green">Vì hành tinh xanh</span>
              <h2>Ăn chay — Hành động nhỏ,<br />tác động lớn</h2>
              <p>Mỗi bữa ăn chay bạn chọn đều góp phần giảm thiểu tác động môi trường. GreenPath giúp bạn theo dõi dấu ấn tích cực của lối sống bền vững.</p>
              <div className="eco-stats">
                <div className="eco-stat"><span className="eco-num">2.5<small>kg</small></span><span className="eco-label">CO₂ tiết kiệm mỗi ngày</span></div>
                <div className="eco-stat"><span className="eco-num">550<small>L</small></span><span className="eco-label">Nước tiết kiệm mỗi bữa</span></div>
                <div className="eco-stat"><span className="eco-num">70<small>%</small></span><span className="eco-label">Giảm carbon footprint</span></div>
              </div>
            </div>
            <div className="sustainability-img-wrap">
              <img src="https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=600&q=80" alt="Sustainable eating" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo">
                <div className="logo-icon"><img src="/logo.png" alt="GreenPath" /></div>
                <span className="footer-brand-name">GreenPath</span>
              </div>
              <p className="footer-brand-desc">Nền tảng hỗ trợ ăn chay bền vững dành cho người Việt. Sống khỏe — Ăn đúng — Yêu thương hành tinh.</p>
              <div className="footer-social-links">
                <a className="footer-social-btn facebook" href="https://www.facebook.com/profile.php?id=61590497844740" target="_blank" rel="noreferrer" aria-label="Facebook GreenPath">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                  Facebook
                </a>
                <a className="footer-social-btn email" href="mailto:GreenPath3333@gmail.com" aria-label="Email hỗ trợ">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Email hỗ trợ
                </a>
              </div>
            </div>
            <div className="footer-col">
              <h4>Sản phẩm</h4>
              <ul>
                <li><a href="#features">Tính năng</a></li>
                <li><a href="#how-it-works">Cách hoạt động</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Hỗ trợ</h4>
              <ul>
                <li><Link to="/terms">Điều khoản dịch vụ</Link></li>
                <li><Link to="/privacy">Chính sách bảo mật</Link></li>
                <li><Link to="/contact">Liên hệ</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 GreenPath. All rights reserved. Made with 💚 in Vietnam</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Landing;
