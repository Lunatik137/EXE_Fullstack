import { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import './MealPlanPreview.css';

const MealPlanPreview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { url, token } = useContext(StoreContext);
  const [loading, setLoading] = useState(true);
  const [mealPlan, setMealPlan] = useState(null);
  const { planType, duration } = location.state || {};

  useEffect(() => {
    if (!planType || !duration) {
      toast.error('Thông tin không hợp lệ!');
      navigate('/plan-selection');
      return;
    }

    generateMealPlan();
  }, []);

  const generateMealPlan = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${url}/api/meal-plan/generate`,
        { planType, duration },
        { headers: { token } }
      );

      if (response.data.success) {
        setMealPlan(response.data.mealPlan);
      } else {
        toast.error(response.data.message);
        navigate('/plan-selection');
      }
    } catch (error) {
      console.error('Error generating meal plan:', error);
      toast.error('Không thể tạo lộ trình. Vui lòng thử lại!');
      navigate('/plan-selection');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      const response = await axios.post(
        `${url}/api/meal-plan/confirm`,
        { mealPlanId: mealPlan._id },
        { headers: { token } }
      );

      if (response.data.success) {
        toast.success('Lộ trình đã được kích hoạt!');
        navigate('/');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error('Error confirming meal plan:', error);
      toast.error('Đã có lỗi xảy ra!');
    }
  };

  const handleRegenerate = () => {
    toast.info('Đang tạo lộ trình mới...');
    generateMealPlan();
  };

  if (loading) {
    return (
      <div className="meal-plan-preview-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>🤖 AI đang tạo lộ trình cho bạn...</h2>
          <p>Vui lòng đợi trong giây lát</p>
          <div className="loading-tips">
            <p>💡 Chúng tôi đang phân tích thông tin của bạn</p>
            <p>🥗 Lựa chọn các món ăn phù hợp nhất</p>
            <p>📊 Tính toán dinh dưỡng cân đối</p>
          </div>
        </div>
      </div>
    );
  }

  if (!mealPlan) {
    return null;
  }

  return (
    <div className="meal-plan-preview-container">
      <div className="meal-plan-preview-content">
        <div className="preview-header">
          <h1>🎉 Lộ trình của bạn đã sẵn sàng!</h1>
          <p>Xem trước và xác nhận lộ trình {duration} ngày</p>
        </div>

        {/* Plan Summary */}
        <div className="plan-summary">
          <div className="summary-card">
            <span className="summary-icon">📅</span>
            <div>
              <h3>{duration} ngày</h3>
              <p>Thời lượng</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🍽️</span>
            <div>
              <h3>{duration * 3} bữa</h3>
              <p>Tổng số bữa ăn</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🥗</span>
            <div>
              <h3>{mealPlan.totalRecipes || 'Đa dạng'}</h3>
              <p>Món ăn khác nhau</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">⚡</span>
            <div>
              <h3>{mealPlan.avgCalories || '~1800'} kcal</h3>
              <p>Trung bình/ngày</p>
            </div>
          </div>
        </div>

        {/* Sample Days Preview */}
        <div className="days-preview">
          <h2>🗓️ Xem trước một số ngày trong lộ trình</h2>
          
          {mealPlan.days.slice(0, 3).map((day, index) => (
            <div key={index} className="day-card">
              <div className="day-header">
                <h3>Ngày {day.dayNumber}</h3>
                <span className="day-calories">{day.totalCalories || '~1800'} kcal</span>
              </div>
              
              <div className="meals-grid">
                {/* Breakfast */}
                <div className="meal-item breakfast">
                  <div className="meal-header">
                    <span className="meal-icon">🌅</span>
                    <strong>Bữa sáng</strong>
                  </div>
                  <p className="meal-name">{day.breakfast.name}</p>
                  <div className="meal-macros">
                    <span>🔥 {day.breakfast.calories} kcal</span>
                    <span>🥩 {day.breakfast.protein}g protein</span>
                  </div>
                </div>

                {/* Lunch - Combo Meal */}
                <div className="meal-item lunch">
                  <div className="meal-header">
                    <span className="meal-icon">☀️</span>
                    <strong>Bữa trưa</strong>
                  </div>
                  {day.lunch.items ? (
                    <>
                      <div className="combo-items-list">
                        {day.lunch.items.map((item, idx) => (
                          <p key={idx} className="combo-item">
                            {item.isRice ? `${item.name}` : item.name}
                          </p>
                        ))}
                      </div>
                      <div className="meal-macros">
                        <span>🔥 {day.lunch.totalCalories} kcal</span>
                        <span>🥩 {day.lunch.totalProtein}g protein</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="meal-name">{day.lunch.name}</p>
                      <div className="meal-macros">
                        <span>🔥 {day.lunch.calories} kcal</span>
                        <span>🥩 {day.lunch.protein}g protein</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Dinner - Combo Meal */}
                <div className="meal-item dinner">
                  <div className="meal-header">
                    <span className="meal-icon">🌙</span>
                    <strong>Bữa tối</strong>
                  </div>
                  {day.dinner.items ? (
                    <>
                      <div className="combo-items-list">
                        {day.dinner.items.map((item, idx) => (
                          <p key={idx} className="combo-item">
                            {item.isRice ? `${item.name}` : item.name}
                          </p>
                        ))}
                      </div>
                      <div className="meal-macros">
                        <span>🔥 {day.dinner.totalCalories} kcal</span>
                        <span>🥩 {day.dinner.totalProtein}g protein</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="meal-name">{day.dinner.name}</p>
                      <div className="meal-macros">
                        <span>🔥 {day.dinner.calories} kcal</span>
                        <span>🥩 {day.dinner.protein}g protein</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {duration > 3 && (
            <div className="more-days-note">
              <p>+ Còn {duration - 3} ngày nữa trong lộ trình của bạn</p>
              <p className="note-small">Bạn sẽ thấy toàn bộ sau khi xác nhận</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="btn-secondary" onClick={() => navigate('/plan-selection')}>
            ← Chọn lại gói
          </button>
          <button className="btn-regenerate" onClick={handleRegenerate}>
            🔄 Tạo lộ trình khác
          </button>
          <button className="btn-primary" onClick={handleConfirm}>
            ✓ Xác nhận & Bắt đầu
          </button>
        </div>

        <p className="disclaimer-text">
          💡 <strong>Lưu ý:</strong> Lộ trình này được tạo dựa trên thông tin của bạn. 
          Bạn có thể điều chỉnh và thay đổi món ăn bất kỳ lúc nào.
        </p>
      </div>
    </div>
  );
};

export default MealPlanPreview;
