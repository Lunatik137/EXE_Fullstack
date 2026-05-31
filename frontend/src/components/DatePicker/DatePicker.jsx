import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './DatePicker.css';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const toDateKey = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfWeekMonday = (dateInput) => {
  const date = new Date(dateInput || new Date());
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  return date;
};

const formatDateMonth = (date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${day}/${month}`;
};

const DatePicker = ({ selectedDate, setSelectedDate, mealPlan, subscriptionInfo }) => {
  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(() =>
    getStartOfWeekMonday(selectedDate || new Date())
  );

  const getUnlockedDaysCount = () => {
    if (!mealPlan?.days?.length) return 0;

    const totalDays = mealPlan.days.length;
    const planType = subscriptionInfo?.planType || 'free';
    const subscriptionStatus = subscriptionInfo?.subscriptionStatus || 'active';

    if (planType === 'premium' && subscriptionStatus === 'active') {
      return totalDays;
    }

    if (planType === 'premium' && subscriptionInfo?.subscriptionEndDate) {
      const endDate = new Date(subscriptionInfo.subscriptionEndDate);
      const unlockedDays = mealPlan.days.filter((day) => new Date(day.date) <= endDate).length;
      return Math.max(0, Math.min(totalDays, unlockedDays));
    }

    // Free users can view the first 30 days of a long plan.
    return Math.min(totalDays, 30);
  };

  const unlockedDaysCount = getUnlockedDaysCount();

  useEffect(() => {
    setCurrentWeekStartDate(getStartOfWeekMonday(selectedDate || new Date()));
  }, [selectedDate]);
  
  // Always render a full Monday-Sunday week; mark locked only for gated meal-plan days.
  const generateDays = () => {
    const days = [];
    const mealPlanDays = mealPlan?.days || [];
    const mealPlanDateMap = new Map(
      mealPlanDays.map((day, index) => [
        toDateKey(day.date),
        { index, day }
      ])
    );

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStartDate);
      date.setDate(currentWeekStartDate.getDate() + i);

      const dateKey = toDateKey(date);
      const dayData = mealPlanDateMap.get(dateKey);
      const weekdayIndex = (date.getDay() + 6) % 7;
      const isSelected = selectedDate && toDateKey(selectedDate) === dateKey;

      days.push({
        dayOfWeek: WEEKDAY_LABELS[weekdayIndex],
        dateLabel: formatDateMonth(date),
        date,
        isToday: isSelected,
        isLocked: dayData ? dayData.index >= unlockedDaysCount : false
      });
    }
    
    return days;
  };
  
  const days = generateDays();
  
  const handlePrevWeek = () => {
    const previousWeekStart = new Date(currentWeekStartDate);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    setCurrentWeekStartDate(previousWeekStart);
  };
  
  const handleNextWeek = () => {
    const nextWeekStart = new Date(currentWeekStartDate);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    setCurrentWeekStartDate(nextWeekStart);
  };
  
  const handleDateSelect = (date, isLocked) => {
    if (isLocked) return;
    setSelectedDate(new Date(date));
  };
  
  return (
    <div className="date-picker">
      <button 
        className="nav-btn prev-btn" 
        onClick={handlePrevWeek}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      <div className="days-container">
        {days.map((day, index) => (
          <button
            key={index}
            className={`day-btn ${day.isToday ? 'active' : ''} ${day.isLocked ? 'locked' : ''}`}
            onClick={() => handleDateSelect(day.date, day.isLocked)}
            disabled={day.isLocked}
            title={day.isLocked ? 'Premium required' : ''}
          >
            <span className="day-of-week">{day.dayOfWeek}</span>
            <span className="day-number">{day.dateLabel}</span>
            {day.isLocked && <span className="day-lock">🔒</span>}
          </button>
        ))}
      </div>
      
      <button 
        className="nav-btn next-btn" 
        onClick={handleNextWeek}
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
  mealPlan: PropTypes.object,
  subscriptionInfo: PropTypes.object
};

export default DatePicker;
