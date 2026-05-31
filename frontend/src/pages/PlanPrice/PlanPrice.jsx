import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import './PlanPrice.css';

const PlanPrice = () => {
  const navigate = useNavigate();
  const { url, token } = useContext(StoreContext);
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPlan = async (plan) => {
    setSelectedPlan(plan);
  };

  const handleConfirm = async () => {
    if (selectedPlan === 'premium') {
      navigate('/payment', { state: { packageId: 'premium-3-month' } });
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${url}/api/user/select-plan`,
        { planType: selectedPlan },
        { headers: { token } }
      );

      if (response.data.success) {
        toast.success('Đã chọn gói Cơ Bản!');
        navigate('/home');
      } else {
        toast.error(response.data.message || 'Đã có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast.error('Không thể chọn gói. Vui lòng thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="plan-price-container">

      {/* Mobile-only premium upsell screen */}
      <section className="mobile-premium-screen">
        <button className="mobile-premium-close" onClick={() => navigate(-1)} aria-label="Đóng">
          ×
        </button>
        <div className="mobile-premium-body">
          <div className="mobile-premium-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <h1 className="mobile-premium-title">GreenPath Premium</h1>
          <p className="mobile-premium-subtitle">Nâng cấp để có trải nghiệm trọn vẹn hơn</p>
          <ul className="mobile-premium-features">
            <li><span className="mf-check">✓</span><span>Lộ trình chuyên sâu (Giảm cân, Tăng cơ)</span></li>
            <li><span className="mf-check">✓</span><span>Công thức độc quyền từ chuyên gia</span></li>
            <li><span className="mf-check">✓</span><span>Phân tích sức khoẻ &amp; Vi chất chi tiết</span></li>
            <li><span className="mf-check">✓</span><span>Thực đơn cá nhân hoá hằng ngày</span></li>
            <li><span className="mf-check">✓</span><span>Tắt quảng cáo</span></li>
          </ul>
          <button
            className="mobile-premium-cta"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Đang xử lý...' : 'Xem 4 gói premium'}
          </button>
          <p className="mobile-premium-disclaimer">Huỷ bất kỳ lúc nào. Điều khoản áp dụng.</p>
        </div>
      </section>

      <div className="plan-price-content">
        {/* Header */}
        <div className="price-header">
          <h1>Nâng cấp GreenPath Premium</h1>
          <p>Mở khóa toàn bộ tiềm năng sức khỏe của bạn với chi phí bằng một cốc cà phê.</p>
        </div>

        {/* Plans Grid */}
        <div className="plans-grid">
          {/* Basic Plan */}
          <div 
            className={`plan-card basic ${selectedPlan === 'free' ? 'selected' : ''}`}
            onClick={() => handleSelectPlan('free')}
          >
            <div className="plan-header-section">
              <h2 className="plan-name">CƠ BẢN</h2>
              <h3 className="plan-price">Miễn phí</h3>
            </div>

            <ul className="plan-features">
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Thực đơn cơ bản hằng ngày</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Tham gia cộng đồng</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Theo dõi tiến độ đơn giản</span>
              </li>
            </ul>

            <button className="plan-btn primary">Gói hiện tại</button>
          </div>

          {/* Premium Plan */}
          <div 
            className={`plan-card premium ${selectedPlan === 'premium' ? 'selected' : ''}`}
            onClick={() => handleSelectPlan('premium')}
          >
            <div className="premium-badge">ĐỀ XUẤT</div>
            
            <div className="plan-header-section">
              <h2 className="plan-name">PREMIUM</h2>
              <div className="plan-pricing">
                <h3 className="plan-price">69k<span className="period">/tháng</span></h3>
                <p className="plan-history">Hỗ trợ 4 gói: 1 tháng, 3 tháng, 12 tháng và Couple.</p>
              </div>
            </div>

            <ul className="plan-features">
              <li className="feature-item">
                <span className="star-icon">⭐</span>
                <span>Lộ trình chuyên sâu (Giảm cân, Tăng cơ)</span>
              </li>
              <li className="feature-item">
                <span className="star-icon">⭐</span>
                <span>Công thức độc quyền từ chuyên gia</span>
              </li>
              <li className="feature-item">
                <span className="star-icon">⭐</span>
                <span>Nhận tư vấn từ chuyên gia</span>
              </li>
              <li className="feature-item">
                <span className="star-icon">⭐</span>
                <span>Tắt quảng cáo</span>
              </li>
            </ul>

            <button 
              className="plan-btn secondary" 
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Đang xử lý...' : 'Chọn gói thanh toán'}
            </button>
          </div>
        </div>

        {/* Confirm Button for Basic */}
        {selectedPlan === 'free' && (
          <div className="basic-confirm-section">
            <button 
              className="confirm-btn"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Đang xử lý...' : 'Tiếp tục'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanPrice;
