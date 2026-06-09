import { useContext, useEffect, useState } from "react";
import "./LoginPopup.css";
import { assets } from "../../assets/frontend_assets/assets";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

const RESEND_COOLDOWN_SECONDS = 60;

const LOGIN_STATE = "Đăng nhập";
const SIGNUP_STATE = "Đăng ký";

const LoginPopup = ({ setShowLogin, initialMode = "Đăng nhập" }) => {
  const { url, setToken, setHasCompletedOnboarding } = useContext(StoreContext);
  const [currentState, setCurrentState] = useState(
    initialMode === "signup" ? SIGNUP_STATE : LOGIN_STATE
  );
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [data, setData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    verificationCode: "",
  });

  const isSignup = currentState === SIGNUP_STATE;

  const resetSignupVerification = () => {
    setVerificationSent(false);
    setResendCountdown(0);
    setData((prev) => ({ ...prev, verificationCode: "" }));
  };

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;

    const timer = setTimeout(() => {
      setResendCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const onChangeHandler = (event) => {
    const { name, value } = event.target;
    setData((prev) => ({ ...prev, [name]: value }));
    if (name === "email" || name === "password") {
      resetSignupVerification();
    }
    setErrorMsg("");
  };

  const handleSendRegisterCode = async () => {
    const response = await axios.post(
      `${url}/api/user/send-register-code`,
      { email: data.email, password: data.password },
      { timeout: 12000 }
    );

    if (!response.data.success) {
      if (response.data.waitSeconds) {
        setResendCountdown(Number(response.data.waitSeconds) || RESEND_COOLDOWN_SECONDS);
      }
      setErrorMsg(response.data.message || "Không thể gửi mã xác nhận");
      return false;
    }

    setVerificationSent(true);
    setResendCountdown(RESEND_COOLDOWN_SECONDS);
    toast.success(response.data.message || "Mã xác nhận đã được gửi tới email");
    return true;
  };

  const resendRegisterCode = async () => {
    if (submitting) return;
    if (resendCountdown > 0) return;

    try {
      setSubmitting(true);
      setErrorMsg("");
      await handleSendRegisterCode();
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || "Không thể gửi lại mã xác nhận";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  const completeRegistration = async () => {
    const response = await axios.post(
      `${url}/api/user/register`,
      {
        email: data.email,
        password: data.password,
        verificationCode: data.verificationCode,
      },
      { timeout: 12000 }
    );

    if (!response.data.success) {
      setErrorMsg(response.data.message || "Đăng ký thất bại");
      return;
    }

    setToken(response.data.token);
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("hasCompletedOnboarding", "false");
    setHasCompletedOnboarding(false);
    setShowLogin({ show: false, mode: "login" });
    navigate("/onboarding");
  };

  const handleLogin = async () => {
    const response = await axios.post(
      `${url}/api/user/login`,
      { email: data.email, password: data.password },
      { timeout: 12000 }
    );

    if (!response.data.success) {
      setErrorMsg(response.data.message || "Đăng nhập thất bại");
      return;
    }

    setToken(response.data.token);
    localStorage.setItem("token", response.data.token);

    const hasOnboarded = response.data.user?.hasCompletedOnboarding;
    localStorage.setItem("hasCompletedOnboarding", hasOnboarded ? "true" : "false");
    setHasCompletedOnboarding(hasOnboarded);

    if (!hasOnboarded) {
      toast.info("Vui lòng hoàn thành thông tin cá nhân");
      setShowLogin({ show: false, mode: "login" });
      navigate("/onboarding");
    } else {
      toast.success("Đăng nhập thành công!");
      setShowLogin({ show: false, mode: "login" });
      navigate("/home");
    }
  };

  const onLogin = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (isSignup && data.password !== data.confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp");
      return;
    }

    if (isSignup && verificationSent && !data.verificationCode.trim()) {
      setErrorMsg("Vui lòng nhập mã xác nhận email");
      return;
    }

    try {
      setSubmitting(true);

      if (!isSignup) {
        await handleLogin();
      } else if (!verificationSent) {
        await handleSendRegisterCode();
      } else {
        await completeRegistration();
      }
    } catch (error) {
      console.error("Login request failed:", { error });
      const message =
        error?.response?.data?.message || error?.message || "Không thể kết nối máy chủ";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchState = (nextState) => {
    setCurrentState(nextState);
    setErrorMsg("");
    resetSignupVerification();
  };

  return (
    <div className="login-popup">
      <form onSubmit={onLogin} className="login-popup-container">
        <div className="login-popup-title">
          <h2>{currentState}</h2>
          <img
            onClick={() => setShowLogin({ show: false, mode: "login" })}
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
            disabled={submitting}
            onInvalid={(e) => {
              if (e.target.validity.valueMissing) e.target.setCustomValidity("Vui lòng nhập email");
              else if (e.target.validity.typeMismatch) e.target.setCustomValidity("Email không hợp lệ");
              else e.target.setCustomValidity("");
            }}
            onInput={(e) => e.target.setCustomValidity("")}
          />

          <div className="password-input-wrapper">
            <input
              name="password"
              onChange={onChangeHandler}
              value={data.password}
              type={showPassword ? "text" : "password"}
              placeholder="Mật khẩu"
              required
              disabled={submitting}
              onInvalid={(e) => e.target.setCustomValidity("Vui lòng nhập mật khẩu")}
              onInput={(e) => e.target.setCustomValidity("")}
            />
            <button
              type="button"
              className="password-toggle-btn"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {isSignup && (
            <div className="password-input-wrapper">
              <input
                name="confirmPassword"
                onChange={onChangeHandler}
                value={data.confirmPassword}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                required
                disabled={submitting}
                onInvalid={(e) => e.target.setCustomValidity("Vui lòng nhập lại mật khẩu")}
                onInput={(e) => e.target.setCustomValidity("")}
              />
              <button
                type="button"
                className="password-toggle-btn"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
              >
                {showConfirmPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          )}

          {isSignup && verificationSent && (
            <>
              <input
                name="verificationCode"
                onChange={onChangeHandler}
                value={data.verificationCode}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Mã xác nhận email"
                required
                disabled={submitting}
                onInvalid={(e) => e.target.setCustomValidity("Vui lòng nhập mã xác nhận email")}
                onInput={(e) => e.target.setCustomValidity("")}
              />
              {resendCountdown > 0 && (
                <span className="resend-countdown">Gửi lại sau {resendCountdown}s</span>
              )}
              <button
                type="button"
                className="resend-code-btn"
                disabled={submitting || resendCountdown > 0}
                onClick={resendRegisterCode}
              >
                Gửi lại mã
              </button>
            </>
          )}
        </div>

        {errorMsg && (
          <div className="login-error-msg">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {errorMsg}
          </div>
        )}

        <button type="submit" disabled={submitting}>
          {submitting
            ? "Đang xử lý..."
            : isSignup
              ? verificationSent
                ? "Hoàn tất đăng ký"
                : "Gửi mã xác nhận"
              : "Đăng nhập"}
        </button>

        {currentState === LOGIN_STATE ? (
          <p className="switch-text">
            Chưa có tài khoản?{" "}
            <span onClick={() => switchState(SIGNUP_STATE)}>Đăng ký ngay</span>
          </p>
        ) : (
          <p className="switch-text">
            Đã có tài khoản?{" "}
            <span onClick={() => switchState(LOGIN_STATE)}>Đăng nhập</span>
          </p>
        )}
      </form>
    </div>
  );
};

LoginPopup.propTypes = {
  setShowLogin: PropTypes.func.isRequired,
  initialMode: PropTypes.string,
};

export default LoginPopup;
