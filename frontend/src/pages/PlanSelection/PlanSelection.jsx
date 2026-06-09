import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import './PlanSelection.css';

const PlanSelection = () => {
  const navigate = useNavigate();
  const { url, token } = useContext(StoreContext);
  const [selectedDuration, setSelectedDuration] = useState('');
  const [userPlan, setUserPlan] = useState('free');
  const [remainingPremiumDays, setRemainingPremiumDays] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Get user's current plan from backend
  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await axios.get(
          `${url}/api/user/current-plan`,
          { headers: { token } }
        );
        if (response.data.success) {
          setUserPlan(response.data.planType || 'free');
          const remainingDays = Number(response.data.remainingPremiumDays || 0);
          setRemainingPremiumDays(remainingDays);

          if (response.data.planType === 'premium' && remainingDays > 0) {
            setSelectedDuration(String(remainingDays));
          } else {
            setSelectedDuration('');
          }
        }
      } catch (error) {
        console.log('Could not fetch user plan, defaulting to free');
        setUserPlan('free');
        setRemainingPremiumDays(0);
        setSelectedDuration('');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPlan();
  }, [url, token]);

  const handleCancel = async () => {
    try {
      if (token) {
        await axios.post(
          `${url}/api/meal-plan/clear-draft`,
          {},
          { headers: { token } }
        );
      }
    } catch (error) {
      console.log('Could not clear draft meal plan on cancel');
    } finally {
      localStorage.removeItem('draftMealPlan');
      localStorage.removeItem('skippedMealPlanIds');
      navigate('/home');
    }
  };

  const handleContinue = () => {
    if (!selectedDuration) {
      toast.error('Bạn cần Premium còn hạn để tạo lộ trình.');
      return;
    }

    // Navigate to meal plan generation
    navigate('/generate-plan', {
      state: {
        planType: userPlan,
        duration: parseInt(selectedDuration),
        mode: 'generate'
      }
    });
  };

  const durations = userPlan === 'premium' && remainingPremiumDays > 0
    ? [{
        value: String(remainingPremiumDays),
        label: `${remainingPremiumDays} ngày (theo thời hạn Premium còn lại)`,
        recommended: true
      }]
    : [];

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
          onClick={handleCancel}
          title="Đóng"
        >
          ✕
        </button>

        <div className="plan-header">
          <h1>Chọn thời lượng lộ trình</h1>
          <p>Bạn sẽ nhận được lộ trình ăn chay cá nhân hóa theo số ngày Premium còn lại</p>
          <p className="plan-badge-info">
            Gói hiện tại: <span className="badge">{userPlan === 'free' ? 'Cơ Bản' : 'Premium'}</span>
          </p>
          {userPlan === 'premium' && remainingPremiumDays > 0 && (
            <p className="plan-badge-info">
              Thời hạn Premium còn lại: <span className="badge">{remainingPremiumDays} ngày</span>
            </p>
          )}
        </div>

        {/* Duration Selection */}
        <div className="duration-section">
          {durations.length > 0 ? (
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
          ) : (
            <p>Bạn chưa có Premium còn hạn. Vui lòng nâng cấp để tạo lộ trình AI.</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="btn-cancel"
            onClick={handleCancel}
          >
            Hủy
          </button>
          <button 
            className="btn-continue"
            onClick={handleContinue}
            disabled={!selectedDuration}
          >
            Tạo lộ trình →
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;
