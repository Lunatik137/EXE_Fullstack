import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import './PlanSelection.css';

const PlanSelection = () => {
  const navigate = useNavigate();
  const { url, token } = useContext(StoreContext);
  const [selectedDuration, setSelectedDuration] = useState('7');
  const [userPlan, setUserPlan] = useState('free');
  const [isLoading, setIsLoading] = useState(true);

  // Get user's current plan from backend
  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await axios.get(
          `${url}/api/users/current-plan`,
          { headers: { token } }
        );
        if (response.data.success) {
          setUserPlan(response.data.planType || 'free');
          // Set default duration based on plan
          setSelectedDuration(response.data.planType === 'premium' ? '30' : '7');
        }
      } catch (error) {
        console.log('Could not fetch user plan, defaulting to free');
        setUserPlan('free');
        setSelectedDuration('7');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPlan();
  }, [url, token]);

  const handleContinue = () => {
    if (!selectedDuration) {
      toast.error('Vui lòng chọn thời lượng lộ trình!');
      return;
    }

    // Navigate to meal plan generation
    navigate('/generate-plan', {
      state: {
        planType: userPlan,
        duration: parseInt(selectedDuration)
      }
    });
  };

  const durations = userPlan === 'free' 
    ? [{ value: '7', label: '7 ngày', recommended: true }]
    : [
        { value: '14', label: '14 ngày (2 tuần)' },
        { value: '30', label: '30 ngày (1 tháng)', recommended: true },
        { value: '60', label: '60 ngày (2 tháng)' },
        { value: '90', label: '90 ngày (3 tháng)' }
      ];

  if (isLoading) {
    return (
      <div className="plan-selection-container">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="plan-selection-container">
      <div className="plan-selection-content">
        <button 
          className="btn-close"
          onClick={() => navigate('/home')}
          title="Đóng"
        >
          ✕
        </button>

        <div className="plan-header">
          <h1>Chọn thời lượng lộ trình</h1>
          <p>Bạn sẽ nhận được lộ trình ăn chay cá nhân hóa</p>
          <p className="plan-badge-info">
            Gói hiện tại: <span className="badge">{userPlan === 'free' ? 'Cơ Bản' : 'Premium'}</span>
          </p>
        </div>

        {/* Duration Selection */}
        <div className="duration-section">
          <div className="duration-grid">
            {durations.map(duration => (
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
                  {duration.recommended && (
                    <span className="recommended-tag">Đề xuất</span>
                  )}
                  <span className="duration-label">{duration.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="btn-cancel"
            onClick={() => navigate('/home')}
          >
            Hủy
          </button>
          <button 
            className="btn-continue"
            onClick={handleContinue}
          >
            Tạo lộ trình →
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;
