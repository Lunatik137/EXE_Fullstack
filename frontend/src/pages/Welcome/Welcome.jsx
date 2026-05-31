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
            <img src="/logo.png" alt="GreenPath" />
          </div>
          <h1 className="app-title">GreenPath</h1>
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
