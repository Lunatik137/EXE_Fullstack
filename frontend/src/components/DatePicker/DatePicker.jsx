import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './DatePicker.css';

const DatePicker = ({ selectedDate, setSelectedDate, mealPlan }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(0);
  
  // Generate days based on meal plan
  const generateDays = () => {
    if (!mealPlan || !mealPlan.days || mealPlan.days.length === 0) {
      // Fallback to current week if no meal plan
      const days = [];
      const today = new Date();
      const currentDay = today.getDate();
      
      for (let i = -3; i <= 3; i++) {
        const date = new Date(today);
        date.setDate(currentDay + i);
        
        const dayOfWeek = ['CN', 'T.2', 'T.3', 'T.4', 'T.5', 'T.6', 'T.7'][date.getDay()];
        const dayNum = date.getDate();
        
        days.push({
          dayOfWeek,
          dayNum,
          date,
          isToday: i === 0,
          dayNumber: null
        });
      }
      
      return days;
    }

    // Show 7 days from meal plan starting from currentWeekStart
    const days = [];
    const totalDays = mealPlan.days.length;
    const endIndex = Math.min(currentWeekStart + 7, totalDays);
    
    for (let i = currentWeekStart; i < endIndex; i++) {
      const dayData = mealPlan.days[i];
      const date = new Date(dayData.date);
      const dayOfWeek = ['CN', 'T.2', 'T.3', 'T.4', 'T.5', 'T.6', 'T.7'][date.getDay()];
      
      const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
      
      days.push({
        dayOfWeek,
        dayNum: dayData.dayNumber,
        date,
        isToday: isSelected,
        dayNumber: dayData.dayNumber
      });
    }
    
    return days;
  };
  
  const days = generateDays();
  
  const handlePrevWeek = () => {
    if (currentWeekStart > 0) {
      setCurrentWeekStart(Math.max(0, currentWeekStart - 7));
    }
  };
  
  const handleNextWeek = () => {
    if (mealPlan && mealPlan.days) {
      const maxStart = Math.max(0, mealPlan.days.length - 7);
      if (currentWeekStart < maxStart) {
        setCurrentWeekStart(Math.min(maxStart, currentWeekStart + 7));
      }
    }
  };
  
  const handleDateSelect = (date) => {
    setSelectedDate(new Date(date));
  };
  
  // Check if navigation buttons should be disabled
  const canGoPrev = currentWeekStart > 0;
  const canGoNext = mealPlan && mealPlan.days && currentWeekStart + 7 < mealPlan.days.length;
  
  return (
    <div className="date-picker">
      <button 
        className="nav-btn prev-btn" 
        onClick={handlePrevWeek}
        disabled={!canGoPrev}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      <div className="days-container">
        {days.map((day, index) => (
          <button
            key={index}
            className={`day-btn ${day.isToday ? 'active' : ''}`}
            onClick={() => handleDateSelect(day.date)}
          >
            <span className="day-of-week">{day.dayOfWeek}</span>
            <span className="day-number">{day.dayNumber ? day.dayNumber : day.dayNum}</span>
          </button>
        ))}
      </div>
      
      <button 
        className="nav-btn next-btn" 
        onClick={handleNextWeek}
        disabled={!canGoNext}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  );
};

DatePicker.propTypes = {
  selectedDate: PropTypes.object,
  setSelectedDate: PropTypes.func,
  mealPlan: PropTypes.object
};

export default DatePicker;
