import { useState, useEffect } from 'react';
import './Sidebar.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  
  // Initialize activeMenu based on current route to avoid flash
  const getActiveMenuFromPath = (path) => {
    if (path === '/') return 'home';
    if (path === '/recipes') return 'recipes';
    if (path === '/community') return 'community';
    if (path === '/myprofile') return 'profile';
    return 'home';
  };

  const [activeMenu, setActiveMenu] = useState(() => getActiveMenuFromPath(location.pathname));

  useEffect(() => {
    // Update active menu based on current route
    setActiveMenu(getActiveMenuFromPath(location.pathname));
  }, [location.pathname]);

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <Link to="/" className="logo-container">
          <div className="logo-icon">🌿</div>
          {!isCollapsed && <h2 className="logo-text">GreenPath</h2>}
        </Link>
      </div>

      <nav className="sidebar-nav">
        <Link 
          to="/" 
          className={`nav-item ${activeMenu === 'home' ? 'active' : ''}`}
          onClick={() => setActiveMenu('home')}
        >
          <span className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-house-door" viewBox="0 0 16 16">
  <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v4z"/>
</svg></span>
          <span className="nav-text">Trang chủ</span>
        </Link>

        <Link 
          to="/recipes" 
          className={`nav-item ${activeMenu === 'recipes' ? 'active' : ''}`}
          onClick={() => setActiveMenu('recipes')}
        >
          <span className="nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-journal-text" viewBox="0 0 16 16">
  <path d="M5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/>
  <path d="M3 0h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1h1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1H1V2a2 2 0 0 1 2-2"/>
  <path d="M1 5v-.5a.5.5 0 0 1 1 0V5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 3v-.5a.5.5 0 0 1 1 0V8h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1z"/>
</svg></span>
          <span className="nav-text">Thư viện công thức</span>
        </Link>

        <Link 
          to="/community" 
          className={`nav-item ${activeMenu === 'community' ? 'active' : ''}`}
          onClick={() => setActiveMenu('community')}
        >
          <span className="nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-people" viewBox="0 0 16 16">
              <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/>
            </svg>
          </span>
          <span className="nav-text">Cộng đồng</span>
        </Link>

        <Link 
          to="/myprofile" 
          className={`nav-item ${activeMenu === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveMenu('profile')}
        >
          <span className="nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-person" viewBox="0 0 16 16">
  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
</svg>
          </span>
          <span className="nav-text">Hồ sơ cá nhân</span>
        </Link>
      </nav>

      {!isCollapsed && (
        <div className="premium-section">
          <span className="premium-icon">
            <svg
  width="50"
  height="40"
  viewBox="0 0 256 256"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor"
  strokeWidth="12"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <path d="M40 96L88 40H168L216 96L128 216L40 96Z" />
  <path d="M88 40L128 96L168 40" />
  <path d="M40 96H216" />
  <path d="M88 96L128 216" />
  <path d="M168 96L128 216" />
</svg>
          </span>
          <h3>Premium</h3>
          <p>Mở khóa toàn bộ tính năng cao cấp.</p>
          <button className="upgrade-btn" onClick={() => setShowPremiumModal(true)}>Nâng cấp ngay</button>
        </div>
      )}

      {/* Premium Comparison Modal */}
      {showPremiumModal && (
        <div className="premium-modal-overlay" onClick={() => setShowPremiumModal(false)}>
          <div className="premium-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowPremiumModal(false)}>×</button>
            
            <div className="modal-header">
              <h2>Nâng cấp Greenpath Premium</h2>
              <p className="modal-subtitle">Mở khoá toàn bộ tiềm năng sức khoẻ của bạn với chi phí bằng một cốc cà phê.</p>
            </div>

            <div className="modal-pricing-cards">
              {/* Free Plan */}
              <div className="modal-pricing-card modal-free-card">
                <div className="modal-card-header">
                  <p className="modal-plan-label">Cơ bản</p>
                  <h3 className="modal-plan-price">Miễn phí</h3>
                </div>

                <div className="modal-features-list">
                  <div className="modal-feature-item">
                    <span className="modal-check-icon">✓</span>
                    <span>Thực đơn cơ bản hằng ngày</span>
                  </div>
                  <div className="modal-feature-item">
                    <span className="modal-check-icon">✓</span>
                    <span>Tham gia cộng đồng</span>
                  </div>
                  <div className="modal-feature-item">
                    <span className="modal-check-icon">✓</span>
                    <span>Theo dõi tiến độ đơn giản</span>
                  </div>
                </div>

                <button className="modal-plan-btn modal-current-plan-btn">Gói hiện tại</button>
              </div>

              {/* Premium Plan */}
              <div className="modal-pricing-card modal-premium-card">
                <div className="modal-recommended-badge">ĐỀ XUẤT</div>
                <div className="modal-card-header">
                  <p className="modal-plan-label modal-premium-label">Premium</p>
                  <div className="modal-price-section">
                    <h3 className="modal-plan-price">39k <span className="modal-price-period">/tháng</span></h3>
                    <p className="modal-discount-info">Hoặc 379k / năm (Tiết kiệm 20%)</p>
                  </div>
                </div>

                <div className="modal-features-list modal-premium-features">
                  <div className="modal-feature-item modal-premium-feature">
                    <span className="modal-star-icon">⭐</span>
                    <span>Lộ trình chuyên sâu (Giảm cân, Tăng cơ)</span>
                  </div>
                  <div className="modal-feature-item modal-premium-feature">
                    <span className="modal-star-icon">⭐</span>
                    <span>Công thức độc quyền từ chuyên gia</span>
                  </div>
                  <div className="modal-feature-item modal-premium-feature">
                    <span className="modal-star-icon">⭐</span>
                    <span>Phân tích vi chất chi tiết</span>
                  </div>
                  <div className="modal-feature-item modal-premium-feature">
                    <span className="modal-star-icon">⭐</span>
                    <span>Tắt quảng cáo</span>
                  </div>
                </div>

                <button 
                  className="modal-plan-btn modal-premium-btn"
                  onClick={() => {
                    setShowPremiumModal(false);
                    navigate('/premium');
                  }}
                >
                  Đăng ký ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button 
        className={isCollapsed ? "expand-sidebar-btn" : "toggle-sidebar-btn-bottom"} 
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? '»' : '«'}
      </button>
    </div>
  );
};

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  setIsCollapsed: PropTypes.func.isRequired
};

export default Sidebar;
