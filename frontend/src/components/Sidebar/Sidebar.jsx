import { useState, useEffect, useContext, useRef } from "react";
import { createPortal } from "react-dom";
import "./Sidebar.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { url, token, setToken } = useContext(StoreContext);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [userPlan, setUserPlan] = useState("free");
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);

  useEffect(() => {
    document.body.style.overflow = showPremiumModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPremiumModal]);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileNavRef = useRef(null);

  const getActiveMenuFromPath = (path) => {
    if (path === "/home") return "home";
    if (path === "/recipes") return "recipes";
    if (path === "/community") return "community";
    if (path === "/myprofile") return "profile";
    if (path === "/consultation") return "consultation";
    return "home";
  };

  const [activeMenu, setActiveMenu] = useState(() =>
    getActiveMenuFromPath(location.pathname),
  );

  useEffect(() => {
    setActiveMenu(getActiveMenuFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await axios.get(`${url}/api/user/current-plan`, {
          headers: { token },
        });
        if (response.data.success) {
          setUserPlan(response.data.planType || "free");
        }
      } catch (error) {
        console.log("Could not fetch user plan, defaulting to free");
        setUserPlan("free");
      } finally {
        setIsLoadingPlan(false);
      }
    };

    if (token) {
      fetchUserPlan();
    } else {
      setIsLoadingPlan(false);
    }
  }, [url, token, location.pathname]);

  useEffect(() => {
    if (!showProfileDropdown) return undefined;

    const handleOutsideClick = (event) => {
      if (window.innerWidth > 768) return;

      if (
        profileNavRef.current &&
        !profileNavRef.current.contains(event.target)
      ) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showProfileDropdown]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken("");
    navigate("/");
  };

  const handleProfileClick = (e) => {
    localStorage.removeItem("home_selected_date");
    if (window.innerWidth <= 768) {
      e.preventDefault();
      setShowProfileDropdown(!showProfileDropdown);
    } else {
      setActiveMenu("profile");
    }
  };

  return (
    <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <Link to="/home" className="logo-container">
          <div className="logo-icon"><img src="/logo.png" alt="GreenPath" /></div>
          {!isCollapsed && <h2 className="logo-text">GreenPath</h2>}
        </Link>
      </div>

      <nav className="sidebar-nav">
        <Link
          to="/home"
          className={`nav-item ${activeMenu === "home" ? "active" : ""}`}
          onClick={() => setActiveMenu("home")}
        >
          <span className="nav-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v4z" />
            </svg>
          </span>
          <span className="nav-text">Trang chủ</span>
        </Link>

        <Link
          to="/recipes"
          className={`nav-item ${activeMenu === "recipes" ? "active" : ""}`}
          onClick={() => {
            setActiveMenu("recipes");
            localStorage.removeItem("home_selected_date");
          }}
        >
          <span className="nav-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5" />
              <path d="M3 0h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1h1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1H1V2a2 2 0 0 1 2-2" />
              <path d="M1 5v-.5a.5.5 0 0 1 1 0V5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 3v-.5a.5.5 0 0 1 1 0V8h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1z" />
            </svg>
          </span>
          <span className="nav-text">Thư viện công thức</span>
        </Link>

        <Link
          to="/community"
          className={`nav-item ${activeMenu === "community" ? "active" : ""}`}
          onClick={() => {
            setActiveMenu("community");
            localStorage.removeItem("home_selected_date");
          }}
        >
          <span className="nav-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />
            </svg>
          </span>
          <span className="nav-text">Cộng đồng</span>
        </Link>

        <div className="profile-nav" ref={profileNavRef}>
          <Link
            to="/myprofile"
            className={`nav-item ${activeMenu === "profile" ? "active" : ""}`}
            onClick={handleProfileClick}
          >
            <span className="nav-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
              </svg>
            </span>
            <span className="nav-text">Hồ sơ</span>
          </Link>

          {showProfileDropdown && (
            <div className="profile-dropdown active">
              <Link
                to="/myprofile"
                className="profile-dropdown-item"
                onClick={() => setShowProfileDropdown(false)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
                </svg>
                Hồ sơ cá nhân
              </Link>
              {userPlan === "free" && (
                <div
                  className="profile-dropdown-item upgrade"
                  onClick={() => {
                    setShowProfileDropdown(false);
                    setShowPremiumModal(true);
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 256 256"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    stroke="currentColor"
                    strokeWidth="16"
                  >
                    <path d="M40 96L88 40H168L216 96L128 216L40 96Z" />
                  </svg>
                  Nâng cấp Premium
                </div>
              )}
              {false && userPlan !== "free" && !isLoadingPlan && (
                <Link
                  to="/consultation"
                  className="profile-dropdown-item consultation"
                  onClick={() => setShowProfileDropdown(false)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M8 1a5 5 0 0 0-5 5v1h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a7 7 0 0 1 14 0v6a3 3 0 0 1-3 3h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h1v-3a1 1 0 0 1 1-1h1V6a5 5 0 0 0-5-5" />
                  </svg>
                  Đặt lịch tư vấn
                </Link>
              )}
              <div
                className="profile-dropdown-item logout"
                onClick={handleLogout}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"
                  />
                  <path
                    fillRule="evenodd"
                    d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"
                  />
                </svg>
                Đăng xuất
              </div>
            </div>
          )}
        </div>
      </nav>

      {!isCollapsed && !isLoadingPlan && userPlan === "free" && (
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
          <button
            className="upgrade-btn"
            onClick={() => setShowPremiumModal(true)}
          >
            Nâng cấp ngay
          </button>
        </div>
      )}

      {false && !isCollapsed && !isLoadingPlan && userPlan !== "free" && (
        <div className="consultation-sidebar-section">
          <span className="consultation-sidebar-icon">
            <svg
              width="50"
              height="50"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.3.3 0 1 0 .2.3" />
              <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" />
              <circle cx="20" cy="10" r="2" />
            </svg>
          </span>
          <h3>Tư vấn chuyên gia</h3>
          <p>Đặt lịch gặp bác sĩ dinh dưỡng.</p>
          <button
            className="consultation-sidebar-btn"
            onClick={() => {
              navigate("/consultation");
              setActiveMenu("consultation");
            }}
          >
            Đặt lịch ngay
          </button>
        </div>
      )}

      {showPremiumModal && createPortal(
        <div
          className="premium-modal-overlay"
          onClick={() => setShowPremiumModal(false)}
        >
          <div
            className="premium-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setShowPremiumModal(false)}
            >
              ×
            </button>
            <div className="modal-mobile-icon" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div className="modal-header">
              <h2>GreenPath Premium</h2>
              <p className="modal-subtitle">
                Nâng cấp để có trải nghiệm trọn vẹn hơn
              </p>
            </div>
            <div className="modal-pricing-cards">
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
                <button className="modal-plan-btn modal-current-plan-btn">
                  Gói hiện tại
                </button>
              </div>
              <div className="modal-pricing-card modal-premium-card">
                <div className="modal-recommended-badge">ĐỀ XUẤT</div>
                <div className="modal-card-header">
                  <p className="modal-plan-label modal-premium-label">
                    Premium
                  </p>
                  <div className="modal-price-section">
                    <h3 className="modal-plan-price">
                      69k <span className="modal-price-period">/tháng</span>
                    </h3>
                    <p className="modal-discount-info">
                      4 gói linh hoạt, bao gồm cả gói Couple cho 2 người.
                    </p>
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
                    <span>Nhận tư vấn từ chuyên gia</span>
                  </div>
                  <div className="modal-feature-item modal-premium-feature">
                    <span className="modal-star-icon">⭐</span>
                    <span>
                      Thông báo nhắc nhở đúng bữa ăn theo giờ tùy chọn
                    </span>
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
                    navigate("/payment", {
                      state: { packageId: "premium-1-month" },
                    });
                  }}
                >
                  Chọn gói premium
                </button>
                <p className="modal-premium-disclaimer">
                  Huỷ bất kỳ lúc nào. Điều khoản áp dụng.
                </p>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      <button
        className={
          isCollapsed ? "expand-sidebar-btn" : "toggle-sidebar-btn-bottom"
        }
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? "»" : "«"}
      </button>
    </div>
  );
};

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  setIsCollapsed: PropTypes.func.isRequired,
};

export default Sidebar;
