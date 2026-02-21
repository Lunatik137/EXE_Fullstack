import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './PlanSelection.css';

const PlanSelection = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [selectedDuration, setSelectedDuration] = useState('3');

  const handleContinue = () => {
    if (!selectedDuration) {
      toast.error('Vui lòng chọn thời lượng lộ trình!');
      return;
    }

    // Navigate to meal plan generation with selected options
    navigate('/generate-plan', {
      state: {
        planType: selectedPlan,
        duration: parseInt(selectedDuration)
      }
    });
  };

  const freeDurations = [
    { value: '3', label: '3 ngày', recommended: true },
    { value: '7', label: '7 ngày' }
  ];

  const premiumDurations = [
    { value: '14', label: '14 ngày (2 tuần)' },
    { value: '30', label: '30 ngày (1 tháng)', recommended: true },
    { value: '60', label: '60 ngày (2 tháng)' },
    { value: '90', label: '90 ngày (3 tháng)' }
  ];

  const currentDurations = selectedPlan === 'free' ? freeDurations : premiumDurations;

  return (
    <div className="plan-selection-container">
      <div className="plan-selection-content">
        <div className="plan-header">
          <h1>Chọn gói lộ trình của bạn</h1>
          <p>Chúng tôi sẽ tạo lộ trình ăn chay cá nhân hóa dựa trên thông tin của bạn</p>
        </div>

        <div className="plans-grid">
          {/* Free Plan */}
          <div 
            className={`plan-card ${selectedPlan === 'free' ? 'selected' : ''}`}
            onClick={() => {
              setSelectedPlan('free');
              setSelectedDuration('3');
            }}
          >
            <div className="plan-badge">Miễn phí</div>
            <h2 className="plan-title">Free Plan</h2>
            <div className="plan-price">
              <span className="price">0đ</span>
            </div>
            
            <ul className="plan-features">
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Lộ trình 3 hoặc 7 ngày</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>3 bữa mỗi ngày (sáng, trưa, tối)</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Recipe pool cơ bản</span>
              </li>
              <li className="feature-item disabled">
                <span className="check-icon">✗</span>
                <span>Không chỉnh macro chi tiết</span>
              </li>
              <li className="feature-item disabled">
                <span className="check-icon">✗</span>
                <span>Không có AI coach</span>
              </li>
            </ul>
          </div>

          {/* Premium Plan */}
          <div 
            className={`plan-card premium ${selectedPlan === 'premium' ? 'selected' : ''}`}
            onClick={() => {
              setSelectedPlan('premium');
              setSelectedDuration('30');
            }}
          >
            <div className="plan-badge premium-badge">Phổ biến nhất</div>
            <h2 className="plan-title">Premium Plan</h2>
            <div className="plan-price">
              <span className="price">30,000đ</span>
              <span className="period">/tháng</span>
            </div>
            
            <ul className="plan-features">
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Lộ trình 14-90 ngày</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>3 bữa mỗi ngày (sáng, trưa, tối)</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Recipe pool đầy đủ</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Cá nhân hóa macro, thời gian nấu</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>AI coach & tùy chỉnh món ăn</span>
              </li>
              <li className="feature-item">
                <span className="check-icon">✓</span>
                <span>Theo dõi tiến độ chi tiết</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Duration Selection */}
        <div className="duration-section">
          <h3>Chọn thời lượng lộ trình</h3>
          <div className="duration-grid">
            {currentDurations.map(duration => (
              <label 
                key={duration.value}
                className={`duration-option ${selectedDuration === duration.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="duration"
                  value={duration.value}
                  checked={selectedDuration === duration.value}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                />
                <div className="duration-content">
                  <span className="duration-label">{duration.label}</span>
                  {duration.recommended && (
                    <span className="recommended-tag">Được đề xuất</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="btn-back"
            onClick={() => navigate('/onboarding')}
          >
            ← Quay lại
          </button>
          <button 
            className="btn-continue"
            onClick={handleContinue}
          >
            Tạo lộ trình ngay →
          </button>
        </div>

        <p className="note-text">
          💡 Bạn có thể thay đổi gói và điều chỉnh lộ trình sau trong phần cài đặt
        </p>
      </div>
    </div>
  );
};

export default PlanSelection;
