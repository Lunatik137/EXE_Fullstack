import React from 'react';
import PropTypes from 'prop-types';
import './NutritionStats.css';

const NutritionStats = ({ todayMeal, loading }) => {

  // Calculate nutrition from today's meals
  const calculateNutrition = () => {
    if (!todayMeal) {
      return {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        fiber: 0,
        cholesterol: 0,
        omega3: 0,
        water: 0,
        saturatedFat: 0,
        sodium: 0
      };
    }

    const nutrition = {
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: 0,
      cholesterol: 0,
      omega3: 0,
      water: 0,
      saturatedFat: 0,
      sodium: 0
    };

    // Add breakfast
    if (todayMeal.breakfast) {
      nutrition.calories += todayMeal.breakfast.calories || 0;
      nutrition.protein += todayMeal.breakfast.protein || 0;
      nutrition.fat += todayMeal.breakfast.fat || 0;
      nutrition.carbs += todayMeal.breakfast.carbs || 0;
      nutrition.fiber += todayMeal.breakfast.fiber || 0;
      nutrition.cholesterol += todayMeal.breakfast.cholesterol || 0;
      nutrition.omega3 += todayMeal.breakfast.omega3 || 0;
      nutrition.water += todayMeal.breakfast.water || 0;
      nutrition.saturatedFat += todayMeal.breakfast.saturatedFat || 0;
      nutrition.sodium += todayMeal.breakfast.sodium || 0;
    }

    // Add lunch (combo meal)
    if (todayMeal.lunch) {
      if (todayMeal.lunch.items && Array.isArray(todayMeal.lunch.items)) {
        todayMeal.lunch.items.forEach(item => {
          nutrition.calories += item.calories || 0;
          nutrition.protein += item.protein || 0;
          nutrition.fat += item.fat || 0;
          nutrition.carbs += item.carbs || 0;
          nutrition.fiber += item.fiber || 0;
          nutrition.cholesterol += item.cholesterol || 0;
          nutrition.omega3 += item.omega3 || 0;
          nutrition.water += item.water || 0;
          nutrition.saturatedFat += item.saturatedFat || 0;
          nutrition.sodium += item.sodium || 0;
        });
      } else {
        nutrition.calories += todayMeal.lunch.calories || 0;
        nutrition.protein += todayMeal.lunch.protein || 0;
        nutrition.fat += todayMeal.lunch.fat || 0;
        nutrition.carbs += todayMeal.lunch.carbs || 0;
        nutrition.fiber += todayMeal.lunch.fiber || 0;
        nutrition.cholesterol += todayMeal.lunch.cholesterol || 0;
        nutrition.omega3 += todayMeal.lunch.omega3 || 0;
        nutrition.water += todayMeal.lunch.water || 0;
        nutrition.saturatedFat += todayMeal.lunch.saturatedFat || 0;
        nutrition.sodium += todayMeal.lunch.sodium || 0;
      }
    }

    // Add dinner (combo meal)
    if (todayMeal.dinner) {
      if (todayMeal.dinner.items && Array.isArray(todayMeal.dinner.items)) {
        todayMeal.dinner.items.forEach(item => {
          nutrition.calories += item.calories || 0;
          nutrition.protein += item.protein || 0;
          nutrition.fat += item.fat || 0;
          nutrition.carbs += item.carbs || 0;
          nutrition.fiber += item.fiber || 0;
          nutrition.cholesterol += item.cholesterol || 0;
          nutrition.omega3 += item.omega3 || 0;
          nutrition.water += item.water || 0;
          nutrition.saturatedFat += item.saturatedFat || 0;
          nutrition.sodium += item.sodium || 0;
        });
      } else {
        nutrition.calories += todayMeal.dinner.calories || 0;
        nutrition.protein += todayMeal.dinner.protein || 0;
        nutrition.fat += todayMeal.dinner.fat || 0;
        nutrition.carbs += todayMeal.dinner.carbs || 0;
        nutrition.fiber += todayMeal.dinner.fiber || 0;
        nutrition.cholesterol += todayMeal.dinner.cholesterol || 0;
        nutrition.omega3 += todayMeal.dinner.omega3 || 0;
        nutrition.water += todayMeal.dinner.water || 0;
        nutrition.saturatedFat += todayMeal.dinner.saturatedFat || 0;
        nutrition.sodium += todayMeal.dinner.sodium || 0;
      }
    }
    
    return nutrition;
  };

  const nutrition = calculateNutrition();

  // Estimate targets based on 2000 calories standard
  const targets = {
    calories: todayMeal?.totalCalories || 2000,
    protein: 100,  // ~20% of calories (400 kcal / 4 kcal/g = 100g)
    fat: 65,       // ~30% of calories (600 kcal / 9 kcal/g = 65g)
    carbs: 250,    // ~50% of calories (1000 kcal / 4 kcal/g = 250g)
    fiber: 30,
    cholesterol: 300,  // mg (recommended max)
    omega3: 1.6,       // g (adequate intake for adults)
    water: 2000,       // ml (8 cups)
    saturatedFat: 20,  // g (< 10% of 2000 cal)
    sodium: 2300       // mg (recommended max)
  };

  // Nutrition overview data
  const nutritionOverview = [
    { label: 'Calories', current: Math.round(nutrition.calories), target: targets.calories, unit: 'kcal', color: '#10b981' },
    { label: 'Protein', current: Math.round(nutrition.protein * 10) / 10, target: targets.protein, unit: 'g', color: '#3b82f6' },
    { label: 'Chất béo', current: Math.round(nutrition.fat * 10) / 10, target: targets.fat, unit: 'g', color: '#f59e0b' },
    { label: 'Carbs', current: Math.round(nutrition.carbs * 10) / 10, target: targets.carbs, unit: 'g', color: '#8b5cf6' },
    { label: 'Chất xơ', current: Math.round(nutrition.fiber * 10) / 10, target: targets.fiber, unit: 'g', color: '#84cc16' }
  ];

  if (loading) {
    return (
      <div className="nutrition-stats">
        <div className="stats-section">
          <div className="loading-skeleton">
            <p>Đang tải thông tin dinh dưỡng...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!todayMeal) {
    return (
      <div className="nutrition-stats">
        <div className="stats-section">
          <div className="no-data">
            <p>Không có dữ liệu dinh dưỡng cho ngày này.</p>
          </div>
        </div>
      </div>
    );
  }

  const CircularProgress = ({ current, target, color, label, unit }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const circumference = 2 * Math.PI * 36; // radius = 36
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="circular-progress-item">
        <div className="circular-progress">
          <svg width="90" height="90" viewBox="0 0 90 90">
            {/* Background circle */}
            <circle
              cx="45"
              cy="45"
              r="36"
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="45"
              cy="45"
              r="36"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 45 45)"
            />
          </svg>
          <div className="progress-content">
            <span className="progress-value">{current}</span>
            <span className="progress-total">/{target}</span>
          </div>
        </div>
        <div className="progress-label">
          <span className="label-text">{label}</span>
          <span className="label-unit">{unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="nutrition-stats">
      {/* Nutrition Overview Section */}
      <div className="stats-section">
        <div className="section-header">
          <h3 className="section-title">Tổng quan về Dinh dưỡng</h3>
        </div>
        <div className="stats-grid">
          {nutritionOverview.map((item, index) => (
            <CircularProgress
              key={index}
              current={item.current}
              target={item.target}
              color={item.color}
              label={item.label}
              unit={item.unit}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

NutritionStats.propTypes = {
  todayMeal: PropTypes.object,
  loading: PropTypes.bool
};

export default NutritionStats;
