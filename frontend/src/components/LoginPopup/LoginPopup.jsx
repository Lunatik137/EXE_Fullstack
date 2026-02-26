import { useContext, useState } from "react";
import "./LoginPopup.css";
import { assets } from "../../assets/frontend_assets/assets";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import PropTypes from 'prop-types';

const LoginPopup = ({ setShowLogin, initialMode = "Đăng nhập" }) => {
  const {url, setToken, setHasCompletedOnboarding } = useContext(StoreContext);
  const [currentState, setCurrentState] = useState(initialMode === 'signup' ? 'Đăng ký' : 'Đăng nhập');
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [data, setData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onLogin = async (event) => {
    event.preventDefault();
    
    // Validate password confirmation for signup
    if (currentState === "Đăng ký" && data.password !== data.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }
    
    let newUrl = url;
    if (currentState === "Đăng nhập") {
      newUrl += "/api/user/login";
    } else {
      newUrl += "/api/user/register";
    }
    
    const response = await axios.post(newUrl, data);
    if (response.data.success) {
      setToken(response.data.token);
      localStorage.setItem("token", response.data.token);
      
      if (currentState === "Đăng ký") {
        // New registration - hasn't completed onboarding yet
        localStorage.setItem("hasCompletedOnboarding", "false");
        setHasCompletedOnboarding(false);
        toast.success("Đăng ký thành công! Hãy hoàn thành thông tin của bạn.");
        setShowLogin({ show: false, mode: 'login' });
        navigate('/onboarding');
      } else {
        // Check if user has completed onboarding
        const hasOnboarded = response.data.user?.hasCompletedOnboarding;
        localStorage.setItem("hasCompletedOnboarding", hasOnboarded ? "true" : "false");
        setHasCompletedOnboarding(hasOnboarded);
        
        if (!hasOnboarded) {
          toast.info("Vui lòng hoàn thành thông tin cá nhân");
          setShowLogin({ show: false, mode: 'login' });
          navigate('/onboarding');
        } else {
          toast.success("Đăng nhập thành công!");
          setShowLogin({ show: false, mode: 'login' });
          navigate('/home');
        }
      }
    } else {
      toast.error(response.data.message);
    }
  };
  return (
    <div className="login-popup">
      <form onSubmit={onLogin} className="login-popup-container">
        <div className="login-popup-title">
          <h2>{currentState}</h2>
          <img
            onClick={() => setShowLogin({ show: false, mode: 'login' })}
            src={assets.cross_icon}
            alt=""
          />
        </div>
        <div className="login-popup-inputs">
          <input
            name="email"
            onChange={onChangeHandler}
            value={data.email}
            type="email"
            placeholder="Email của bạn"
            required
          />
          <div className="password-input-wrapper">
            <input
              name="password"
              onChange={onChangeHandler}
              value={data.password}
              type={showPassword ? "text" : "password"}
              placeholder="Mật khẩu"
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          {currentState === "Đăng ký" && (
            <div className="password-input-wrapper">
              <input
                name="confirmPassword"
                onChange={onChangeHandler}
                value={data.confirmPassword}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
        <button type="submit">
          {currentState === "Đăng ký" ? "Tạo tài khoản" : "Đăng nhập"}
        </button>
        {currentState === "Đăng nhập" ? (
          <p className="switch-text">
            Chưa có tài khoản?{" "}
            <span onClick={() => setCurrentState("Đăng ký")}>Đăng ký ngay</span>
          </p>
        ) : (
          <p className="switch-text">
            Đã có tài khoản?{" "}
            <span onClick={() => setCurrentState("Đăng nhập")}>Đăng nhập</span>
          </p>
        )}
      </form>
    </div>
  );
};

LoginPopup.propTypes = {
  setShowLogin: PropTypes.func.isRequired,
  initialMode: PropTypes.string
};

export default LoginPopup;
