import './TodayMenu.css';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import notificationService from '../../services/notificationService';

const TodayMenu = ({ mealPlan, todayMeal, loading }) => {
  const navigate = useNavigate();

  const handleRecipeClick = (recipeId) => {
    if (recipeId) {
      navigate(`/recipes/${recipeId}`);
    }
  };

  // Setup meal reminders
  useEffect(() => {
    if (!todayMeal) return;

    const setupMealReminders = async () => {
      // Request permission first
      const hasPermission = await notificationService.requestPermission();
      if (!hasPermission) return; // Skip reminders if permission denied
      
      // Subscribe to push notifications
      await notificationService.subscribe();

      // Set reminders for each meal at 30 min before (simplified)
      const mealTimes = [
        { name: 'Bữa sáng', time: '07:00', offset: 7 * 60 },
        { name: 'Bữa trưa', time: '12:00', offset: 12 * 60 },
        { name: 'Bữa tối', time: '18:00', offset: 18 * 60 }
      ];

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      mealTimes.forEach(meal => {
        if (todayMeal[meal.name.toLowerCase().replace('ữa ', '')] && currentMinutes < meal.offset - 30) {
          const timeUntilReminder = (meal.offset - 30 - currentMinutes) * 60 * 1000;
          
          setTimeout(() => {
            notificationService.notifyMealSchedule(meal.name, meal.time);
          }, timeUntilReminder);
        }
      });
    };

    setupMealReminders();
  }, [todayMeal]);

  if (loading) {
    return (
      <div className="today-menu">
        <div className="menu-card">
          <div className="loading-skeleton">
            <p>Đang tải thực đơn...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="today-menu">
        <div className="menu-card">
          <div className="no-plan">
            <p className="title">Chưa có lộ trình</p>
            <p className="description">Hãy tạo lộ trình ăn chay cá nhân hóa để bắt đầu hành trình của bạn!</p>
            <button 
              className="btn-create-plan"
              onClick={() => navigate('/plan-selection')}
            >
              Tạo lộ trình ngay
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!todayMeal) {
    return (
      <div className="today-menu">
        <div className="menu-card">
          <div className="no-meal">
            <p>Không có thực đơn cho ngày này.</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate current day number
  const startDate = new Date(mealPlan.startDate);
  const currentDay = todayMeal.dayNumber;

  return (
    <div className="today-menu">
      <div className="menu-card">
        <div className="menu-card-header">
          <div>
            <h2 className="menu-title">Thực đơn hôm nay</h2>
            <p className="menu-subtitle">Dựa trên lộ trình "{mealPlan.dietType === 'vegan' ? 'Ăn chay' : 'Healthy'}" của bạn</p>
          </div>
          <div className="day-badge">Day {currentDay}/{mealPlan.duration}</div>
        </div>

        <div className="meals-container">
          {/* Breakfast */}
          {todayMeal.breakfast && (
            <div className="meal-card breakfast-card">
              <span className="meal-label breakfast-label">BỮA SÁNG</span>
              <div className="combo-meal-wrapper">
                <div 
                  className="combo-meal-item"
                  onClick={() => handleRecipeClick(todayMeal.breakfast.recipeId)}
                >
                  <span className="meal-bullet">•</span>
                  <span className="meal-text">{todayMeal.breakfast.name}</span>
                </div>
                <div className="item-nutrition-text">
                  {todayMeal.breakfast.calories} kcal, {todayMeal.breakfast.protein}g protein
                </div>
              </div>
            </div>
          )}

          {/* Lunch - Combo Meal */}
          {todayMeal.lunch && (
            <div className="meal-card lunch-card">
              <span className="meal-label lunch-label">BỮA TRƯA</span>
              {todayMeal.lunch.items ? (
                <div className="combo-meals-list">
                  {todayMeal.lunch.items.map((item, idx) => (
                    <div key={idx} className="combo-meal-wrapper">
                      <div 
                        className="combo-meal-item"
                        onClick={() => handleRecipeClick(item.recipeId)}
                      >
                        <span className="meal-bullet">•</span>
                        <span className="meal-text">{item.name}</span>
                      </div>
                      <div className="item-nutrition-text">
                        {item.calories} kcal, {item.protein}g protein
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <h3 
                    className="meal-card-title clickable"
                    onClick={() => handleRecipeClick(todayMeal.lunch.recipeId)}
                  >
                    {todayMeal.lunch.name}
                  </h3>
                  <div className="meal-stats">
                    <span className="stat-item">
                      <span className="stat-icon">🔥</span>
                      <span>{todayMeal.lunch.calories} kcal</span>
                    </span>
                    <span className="stat-item">
                      <span className="stat-icon">🥩</span>
                      <span>{todayMeal.lunch.protein}g protein</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Dinner - Combo Meal */}
          {todayMeal.dinner && (
            <div className="meal-card dinner-card">
              <span className="meal-label dinner-label">BỮA TỐI</span>
              {todayMeal.dinner.items ? (
                <div className="combo-meals-list">
                  {todayMeal.dinner.items.map((item, idx) => (
                    <div key={idx} className="combo-meal-wrapper">
                      <div 
                        className="combo-meal-item"
                        onClick={() => handleRecipeClick(item.recipeId)}
                      >
                        <span className="meal-bullet">•</span>
                        <span className="meal-text">{item.name}</span>
                      </div>
                      <div className="item-nutrition-text">
                        {item.calories} kcal, {item.protein}g protein
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <h3 
                    className="meal-card-title clickable"
                    onClick={() => handleRecipeClick(todayMeal.dinner.recipeId)}
                  >
                    {todayMeal.dinner.name}
                  </h3>
                  <div className="meal-stats">
                    <span className="stat-item">
                      <span className="stat-icon">🔥</span>
                      <span>{todayMeal.dinner.calories} kcal</span>
                    </span>
                    <span className="stat-item">
                      <span className="stat-icon">🥩</span>
                      <span>{todayMeal.dinner.protein}g protein</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

TodayMenu.propTypes = {
  mealPlan: PropTypes.object,
  todayMeal: PropTypes.object,
  loading: PropTypes.bool
};

export default TodayMenu;
