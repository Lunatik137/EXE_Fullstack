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
    setIsLoading(true);
    try {
      // Save plan selection to backend
      const response = await axios.post(
        `${url}/api/users/select-plan`,
        { planType: selectedPlan },
        { headers: { token } }
      );

      if (response.data.success) {
        toast.success(`Đã chọn gói ${selectedPlan === 'free' ? 'Cơ Bản' : 'Premium'}!`);
        
        if (selectedPlan === 'premium') {
          // Go to payment page
          navigate('/payment', { state: { plan: selectedPlan } });
        } else {
          // Basic plan - go directly to home
          navigate('/home');
        }
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
                <h3 className="plan-price">39k<span className="period">/tháng</span></h3>
                <p className="plan-history">Hoặc 379k / năm (Tiết kiếm 20%)</p>
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
                <span>Phân tích và chỉ chi tiết</span>
              </li>
              <li className="feature-item">
                <span className="star-icon">⭐</span>
                <span>Tất quảng cáo</span>
              </li>
            </ul>

            <button 
              className="plan-btn secondary" 
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Đang xử lý...' : 'Đăng ký ngay'}
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
