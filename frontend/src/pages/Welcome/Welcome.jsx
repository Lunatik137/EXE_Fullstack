import { useContext } from 'react';
import { StoreContext } from '../../context/StoreContext';
import './Welcome.css';

const Welcome = () => {
  const { setShowLogin } = useContext(StoreContext);

  const handleLogin = () => {
    setShowLogin({ show: true, mode: 'login' });
  };

  const handleSignUp = () => {
    setShowLogin({ show: true, mode: 'signup' });
  };

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <div className="logo-section">
          <div className="logo-circle">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 5C11.7157 5 5 11.7157 5 20C5 28.2843 11.7157 35 20 35C28.2843 35 35 28.2843 35 20C35 11.7157 28.2843 5 20 5ZM20 8C26.6274 8 32 13.3726 32 20C32 26.6274 26.6274 32 20 32C13.3726 32 8 26.6274 8 20C8 13.3726 13.3726 8 20 8Z" fill="white"/>
              <path d="M15 18L12 20L15 22L18 20L15 18Z" fill="white"/>
              <path d="M25 18L22 20L25 22L28 20L25 18Z" fill="white"/>
            </svg>
          </div>
          <h1 className="app-title">Greenpath</h1>
          <p className="app-description">
            Chúng mình sẽ giúp bạn ăn chay bền vững,<br />
            dễ dàng và đầy cảm hứng.
          </p>
        </div>

        <div className="action-buttons">
          <button className="primary-btn" onClick={handleSignUp}>
            Tạo tài khoản mới
            <span className="btn-arrow">→</span>
          </button>
          <button className="secondary-btn" onClick={handleLogin}>
            Đăng nhập
          </button>
        </div>

        <p className="terms-text">
          Bằng cách tiếp tục, bạn đồng ý với{' '}
          <a href="/terms">Điều khoản dịch vụ</a> và{' '}
          <a href="/privacy">Chính sách bảo mật</a>
        </p>
      </div>
    </div>
  );
};

export default Welcome;
