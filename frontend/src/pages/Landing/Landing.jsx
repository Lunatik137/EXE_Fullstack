import { useContext } from "react";
import { StoreContext } from "../../context/StoreContext";
import "./Landing.css";

const Landing = () => {
  const { setShowLogin } = useContext(StoreContext);

  const handleSignUp = () => {
    setShowLogin({ show: true, mode: "signup" });
  };

  const handleLogin = () => {
    setShowLogin({ show: true, mode: "login" });
  };

  return (
    <div className="landing-page">
      {/* Header/Navigation */}
      <header className="landing-header">
        <div className="container">
          <div className="logo-section">
            <div className="logo-icon">🌿</div>
            <h2 className="logo-text">GreenPath</h2>
          </div>
          <div className="header-buttons">
            <button className="login-btn" onClick={handleLogin}>
              Đăng nhập
            </button>
            <button className="signup-btn" onClick={handleSignUp}>
              Đăng ký
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Hành trình ăn chay
              <br />
              <span className="highlight">Khỏe đẹp & Bền vững</span>
            </h1>
            <p className="hero-description">
              GreenPath đồng hành cùng bạn xây dựng lối sống ăn chay lành mạnh
              với thực đơn cá nhân hóa, công thức đa dạng và cộng đồng nhiệt
              huyết.
            </p>
            <button className="cta-btn" onClick={handleSignUp}>
              Bắt đầu miễn phí →
            </button>
          </div>
          <div className="hero-image">
            <img
              src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600"
              alt="Healthy vegan bowl"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Tính năng nổi bật</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 256 256"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="48" y="56" width="160" height="144" rx="16" />
                  <path d="M88 96h80" />
                  <path d="M88 128h60" />
                  <circle cx="176" cy="88" r="18" />
                  <path d="M176 78v20M166 88h20" />
                </svg>
              </div>
              <h3>Thực đơn cá nhân hóa</h3>
              <p>
                AI tự động tạo thực đơn phù hợp với mục tiêu, sở thích và tình
                trạng sức khỏe của bạn
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 256 256"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="56" y="48" width="120" height="160" rx="12" />
                  <path d="M96 48v160" />
                  <path d="M112 88h40" />
                  <path d="M112 120h40" />
                  <path d="M112 152h30" />
                </svg>
              </div>
              <h3>Thư viện công thức</h3>
              <p>
                Hơn 100+ công thức chay Việt Nam dễ làm, ngon miệng với hướng
                dẫn chi tiết từng bước
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 256 256"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="96" cy="104" r="28" />
                  <circle cx="160" cy="104" r="28" />
                  <path d="M48 184c8-32 56-32 64 0" />
                  <path d="M112 184c8-32 56-32 64 0" />
                </svg>
              </div>
              <h3>Cộng đồng năng động</h3>
              <p>
                Kết nối, chia sẻ trải nghiệm và học hỏi từ những người cùng đam
                mê ăn chay
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 256 256"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M64 200V104" />
                  <path d="M112 200V72" />
                  <path d="M160 200V128" />
                  <rect
                    x="48"
                    y="200"
                    width="144"
                    height="8"
                    rx="4"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </div>
              <h3>Theo dõi dinh dưỡng</h3>
              <p>
                Phân tích vi chất chi tiết, đảm bảo cơ thể được cung cấp đủ
                dưỡng chất thiết yếu
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 256 256"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="128" cy="128" r="72" />
                  <circle cx="128" cy="128" r="40" />
                  <circle
                    cx="128"
                    cy="128"
                    r="12"
                    fill="currentColor"
                    stroke="none"
                  />
                  <path d="M170 86l30-30" />
                </svg>
              </div>
              <h3>Lộ trình mục tiêu</h3>
              <p>
                Chương trình hỗ trợ giảm cân, tăng cơ hoặc duy trì sức khỏe tối
                ưu
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 256 256"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M128 40c-32 0-56 24-56 56v40l-16 32h144l-16-32V96c0-32-24-56-56-56z" />
                  <path d="M104 200a24 24 0 0 0 48 0" />
                </svg>
              </div>
              <h3>Nhắc nhở thông minh</h3>
              <p>
                Không bao giờ bỏ lỡ bữa ăn với hệ thống thông báo và lịch trình
                hàng ngày
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">Cách hoạt động</h2>
          <div className="steps-container">
            <div className="step-item">
              <div className="step-number">1</div>
              <h3>Đăng ký & Khảo sát</h3>
              <p>
                Trả lời vài câu hỏi về mục tiêu, thói quen ăn uống và sức khỏe
                hiện tại
              </p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-item">
              <div className="step-number">2</div>
              <h3>Nhận lộ trình cá nhân</h3>
              <p>
                AI tạo thực đơn phù hợp với riêng bạn, có thể điều chỉnh bất cứ
                lúc nào
              </p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-item">
              <div className="step-number">3</div>
              <h3>Theo dõi & Cải thiện</h3>
              <p>
                Ghi nhận tiến độ, điều chỉnh kế hoạch và đạt được mục tiêu sức
                khỏe
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="container">
          <h2 className="section-title">Tại sao chọn GreenPath?</h2>
          <div className="benefits-grid">
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <div>
                <h4>100% Miễn phí</h4>
                <p>Truy cập đầy đủ tính năng cơ bản mãi mãi, không giới hạn</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <div>
                <h4>Dễ sử dụng</h4>
                <p>
                  Giao diện thân thiện, phù hợp cả người mới bắt đầu ăn chay
                </p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <div>
                <h4>Khoa học & An toàn</h4>
                <p>Được thiết kế dựa trên nguyên lý dinh dưỡng khoa học</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <div>
                <h4>Công thức Việt Nam</h4>
                <p>Nguyên liệu dễ tìm, phù hợp khẩu vị người Việt</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <div>
                <h4>Cộng đồng hỗ trợ</h4>
                <p>Kết nối với hàng ngàn người cùng hành trình</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <div>
                <h4>Luôn cập nhật</h4>
                <p>Thêm công thức mới và tính năng mới thường xuyên</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <div className="logo-icon">🌿</div>
              <h3>GreenPath</h3>
            </div>
            <div className="footer-links">
              <a href="/terms">Điều khoản dịch vụ</a>
              <a href="/privacy">Chính sách bảo mật</a>
              <a href="/contact">Liên hệ</a>
            </div>
            <p className="footer-copyright">
              © 2026 GreenPath. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
