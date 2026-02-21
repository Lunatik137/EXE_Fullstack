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
          navigate('/');
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
          <input
            name="password"
            onChange={onChangeHandler}
            value={data.password}
            type="password"
            placeholder="Mật khẩu"
            required
          />
          {currentState === "Đăng ký" && (
            <input
              name="confirmPassword"
              onChange={onChangeHandler}
              value={data.confirmPassword}
              type="password"
              placeholder="Nhập lại mật khẩu"
              required
            />
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
