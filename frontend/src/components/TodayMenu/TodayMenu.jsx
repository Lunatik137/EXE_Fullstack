import './TodayMenu.css';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { notificationService } from '../../services/notificationService';
import axios from 'axios';
import { toast } from 'react-toastify';
import { StoreContext } from '../../context/StoreContext';
import MealSelectorModal from './MealSelectorModal';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: 'BỮA SÁNG', lunch: 'BỮA TRƯA', dinner: 'BỮA TỐI' };
const MEAL_CARD_CLASS = { breakfast: 'breakfast-card', lunch: 'lunch-card', dinner: 'dinner-card' };
const MEAL_LABEL_CLASS = { breakfast: 'breakfast-label', lunch: 'lunch-label', dinner: 'dinner-label' };
const MANUAL_MENU_LOCK_PREFIX = 'manualMenuLocked_';

const getLocalDateKey = (dateInput) => {
  const d = new Date(dateInput || new Date());
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeVietnameseText = (value = '') =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isWhiteRiceRecipeName = (name = '') =>
  normalizeVietnameseText(name).includes('com trang');

const TodayMenu = ({
  mealPlan,
  todayMeal,
  loading,
  subscriptionInfo,
  selectedDate,
  streakStatus,
  confirmingMeal,
  onConfirmMeal,
  onManualNutritionChange
}) => {
  const { url } = useContext(StoreContext);
  const navigate = useNavigate();
  const [mealReminderSettings, setMealReminderSettings] = useState({
    enabled: false,
    breakfastTime: '',
    lunchTime: '',
    dinnerTime: ''
  });

  // Free user state
  const [freeRecipes, setFreeRecipes] = useState([]);
  const [freeMealPicks, setFreeMealPicks] = useState({ breakfast: '', lunch: [], dinner: [] });
  const [openMealModal, setOpenMealModal] = useState(null); // which mealType is modal open for
  const [manualDaySaving, setManualDaySaving] = useState(false);
  const [manualDaySaved, setManualDaySaved] = useState(false);
  const [manualDayLocked, setManualDayLocked] = useState(false);

  // Determine if user truly has active premium subscription (not just planType=premium in DB)
  const isTrulyPremium =
    subscriptionInfo?.planType === 'premium' &&
    subscriptionInfo?.subscriptionStatus === 'active' &&
    subscriptionInfo?.subscriptionEndDate &&
    new Date(subscriptionInfo.subscriptionEndDate) > new Date();

  const selectedDateValue = selectedDate
    ? new Date(selectedDate)
    : todayMeal?.date
      ? new Date(todayMeal.date)
      : new Date();
  const selectedDateKey = getLocalDateKey(selectedDateValue);
  const manualDayLockStorageKey = `${MANUAL_MENU_LOCK_PREFIX}${selectedDateKey}`;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const selectedDateStart = new Date(selectedDateValue);
  selectedDateStart.setHours(0, 0, 0, 0);

  const isSelectedDateInFuture = selectedDateStart > todayDate;
  const allowManualPickForFutureNoMeal =
    isTrulyPremium &&
    Boolean(mealPlan) &&
    !todayMeal &&
    isSelectedDateInFuture;
  const shouldEnableManualPicker = !isTrulyPremium || allowManualPickForFutureNoMeal;

  useEffect(() => {
    const fetchReminderSettings = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const apiUrl =
          import.meta.env.VITE_API_URL ||
          `${window.location.protocol}//${window.location.hostname}:4000`;
        const response = await axios.post(
          `${apiUrl}/api/user/profile`,
          {},
          { headers: { token } }
        );

        if (response.data.success) {
          setMealReminderSettings({
            enabled: response.data.user?.mealReminderSettings?.enabled || false,
            breakfastTime: response.data.user?.mealReminderSettings?.breakfastTime || '',
            lunchTime: response.data.user?.mealReminderSettings?.lunchTime || '',
            dinnerTime: response.data.user?.mealReminderSettings?.dinnerTime || ''
          });
        }
      } catch (error) {
        console.error('Error fetching reminder settings:', error);
      }
    };

    fetchReminderSettings();
  }, []);

  // Fetch free recipes + restore saved picks in manual-pick modes (free or premium future day without plan meal)
  useEffect(() => {
    if (loading || !shouldEnableManualPicker) return;

    const apiUrl =
      url || import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
    const token = localStorage.getItem('token');

    const fetchFreeRecipes = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/recipes/free`);
        if (response.data.success) setFreeRecipes(response.data.recipes);
      } catch (error) {
        console.error('Error fetching free recipes:', error);
      }
    };

    const fetchManualPicks = async () => {
      if (!token) {
        const saved = localStorage.getItem(`freeMealPicks_${selectedDateKey}`);
        if (saved) {
          try { 
            const parsed = JSON.parse(saved);
            setFreeMealPicks({
              breakfast: parsed.breakfast || '',
              lunch: Array.isArray(parsed.lunch) ? parsed.lunch : [],
              dinner: Array.isArray(parsed.dinner) ? parsed.dinner : []
            });
          } catch { /* ignore */ }
        } else {
          setFreeMealPicks({ breakfast: '', lunch: [], dinner: [] });
        }
        return;
      }

      try {
        const response = await axios.post(
          `${apiUrl}/api/manual-meal-picks/get`,
          { date: selectedDateKey },
          { headers: { token } }
        );

        if (response.data.success && response.data.manualPick?.picks) {
          setFreeMealPicks({
            breakfast: response.data.manualPick.picks.breakfast || '',
            lunch: Array.isArray(response.data.manualPick.picks.lunch) ? response.data.manualPick.picks.lunch : [],
            dinner: Array.isArray(response.data.manualPick.picks.dinner) ? response.data.manualPick.picks.dinner : []
          });
          localStorage.setItem(
            `freeMealPicks_${selectedDateKey}`,
            JSON.stringify(response.data.manualPick.picks)
          );
          return;
        }
      } catch (error) {
        console.error('Error fetching manual meal picks:', error);
      }

      const saved = localStorage.getItem(`freeMealPicks_${selectedDateKey}`);
      if (saved) {
        try { 
          const parsed = JSON.parse(saved);
          setFreeMealPicks({
            breakfast: parsed.breakfast || '',
            lunch: Array.isArray(parsed.lunch) ? parsed.lunch : [],
            dinner: Array.isArray(parsed.dinner) ? parsed.dinner : []
          });
        } catch { /* ignore */ }
      } else {
        setFreeMealPicks({ breakfast: '', lunch: [], dinner: [] });
      }
    };

    fetchManualPicks();
    fetchFreeRecipes();
  }, [loading, shouldEnableManualPicker, selectedDateKey, url]);

  useEffect(() => {
    const isLocked = localStorage.getItem(manualDayLockStorageKey) === '1';
    setManualDayLocked(isLocked);
    setManualDaySaved(isLocked);
  }, [manualDayLockStorageKey]);

  // Emit manual nutrition to parent whenever picks or recipes change
  useEffect(() => {
    if (!shouldEnableManualPicker || !onManualNutritionChange) return;
    const allIds = [
      ...(freeMealPicks.breakfast ? [freeMealPicks.breakfast] : []),
      ...(freeMealPicks.lunch || []),
      ...(freeMealPicks.dinner || [])
    ];
    const nut = allIds.reduce(
      (acc, id) => {
        const r = freeRecipes.find(recipe => recipe._id === id);
        if (!r) return acc;
        return {
          calories: acc.calories + (r.calories || 0),
          protein: acc.protein + (r.protein || 0),
          fat: acc.fat + (r.fat || 0),
          carbs: acc.carbs + (r.carbs || 0),
          fiber: acc.fiber + (r.fiber || 0),
          sodium: acc.sodium + (r.sodium || 0)
        };
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodium: 0 }
    );
    onManualNutritionChange(allIds.length > 0 ? nut : null);
  }, [freeMealPicks, freeRecipes, shouldEnableManualPicker, onManualNutritionChange]);

  const handleFreeMealPick = async (mealType, recipeId, isAdding = true, isRiceHint) => {
    if (manualDayLocked) {
      toast.info('Thực đơn ngày này đã xác nhận, bạn không thể thay đổi nữa.');
      return;
    }

    setManualDaySaved(false);
    let updated;
    
    if (mealType === 'breakfast') {
      updated = { ...freeMealPicks, [mealType]: isAdding ? recipeId : '' };
    } else {
      const currentMeals = freeMealPicks[mealType] || [];
      
      if (isAdding) {
        // Determine isRice: use hint if provided, otherwise lookup
        const recipe = freeRecipes.find(r => r._id === recipeId);
        const isRice = isRiceHint !== undefined ? isRiceHint : (recipe ? isWhiteRiceRecipeName(recipe.name) : false);
        const { riceIds, nonRiceIds } = getSelectedRiceAndNonRice(mealType);

        if (isRice && riceIds.length >= 1) return;
        if (!isRice && nonRiceIds.length >= 5) return;

        updated = { ...freeMealPicks, [mealType]: [...currentMeals, recipeId] };
      } else {
        updated = { ...freeMealPicks, [mealType]: currentMeals.filter(id => id !== recipeId) };
      }
    }

    setFreeMealPicks(updated);
    localStorage.setItem(`freeMealPicks_${selectedDateKey}`, JSON.stringify(updated));

    const token = localStorage.getItem('token');
    if (!token) return;

    const apiUrl =
      url || import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

    try {
      const payload = {
        date: selectedDateKey,
        mealType,
        source: allowManualPickForFutureNoMeal ? 'premium-future-manual' : 'free-tier'
      };

      // For breakfast: send single recipeId
      if (mealType === 'breakfast') {
        payload.recipeId = isAdding ? recipeId : null;
      } else {
        // For lunch/dinner: send array of recipeIds
        payload.recipeIds = updated[mealType] || [];
      }

      await axios.post(
        `${apiUrl}/api/manual-meal-picks/save`,
        payload,
        { headers: { token } }
      );
    } catch (error) {
      console.error('Error saving manual meal pick:', error);
    }
  };

  const isManualDayComplete =
    Boolean(freeMealPicks.breakfast) &&
    Array.isArray(freeMealPicks.lunch) &&
    freeMealPicks.lunch.length > 0 &&
    Array.isArray(freeMealPicks.dinner) &&
    freeMealPicks.dinner.length > 0;

  const handleConfirmManualDayMenu = async () => {
    if (!isManualDayComplete || manualDaySaving) return;

    if (manualDayLocked) {
      toast.info('Thực đơn ngày này đã xác nhận, bạn không thể thay đổi nữa.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setManualDaySaved(true);
      setManualDayLocked(true);
      localStorage.setItem(manualDayLockStorageKey, '1');
      toast.success('Đã lưu thực đơn ngày này trên thiết bị của bạn');
      return;
    }

    const apiUrl =
      url || import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

    const source = allowManualPickForFutureNoMeal ? 'premium-future-manual' : 'free-tier';

    setManualDaySaving(true);
    try {
      const requests = [
        {
          date: selectedDateKey,
          mealType: 'breakfast',
          recipeId: freeMealPicks.breakfast,
          source
        },
        {
          date: selectedDateKey,
          mealType: 'lunch',
          recipeIds: freeMealPicks.lunch,
          source
        },
        {
          date: selectedDateKey,
          mealType: 'dinner',
          recipeIds: freeMealPicks.dinner,
          source
        }
      ];

      const responses = await Promise.all(
        requests.map(payload =>
          axios.post(`${apiUrl}/api/manual-meal-picks/save`, payload, { headers: { token } })
        )
      );

      const hasFailure = responses.some(response => !response?.data?.success);
      if (hasFailure) {
        throw new Error('save_failed');
      }

      setManualDaySaved(true);
      setManualDayLocked(true);
      localStorage.setItem(manualDayLockStorageKey, '1');
      setOpenMealModal(null);
      toast.success('Đã lưu thực đơn cho ngày đã chọn');
    } catch (error) {
      console.error('Error confirming manual day menu:', error);
      toast.error('Không thể lưu thực đơn. Vui lòng thử lại.');
    } finally {
      setManualDaySaving(false);
    }
  };

  const handleRecipeClick = (recipeId) => {
    if (recipeId) {
      navigate(`/recipes/${recipeId}`);
    }
  };

  // Setup meal reminders
  useEffect(() => {
    if (!mealReminderSettings.enabled) return;

    const ensurePushSubscription = async () => {
      const hasPermission = await notificationService.requestPermission();
      if (!hasPermission) return;
      await notificationService.subscribe();
    };

    ensurePushSubscription();
  }, [mealReminderSettings.enabled]);

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

  const getAvailableRecipesForMeal = () => {
    // Return all recipes for all meal types
    return freeRecipes;
  };

  const getSelectedRiceAndNonRice = (mealType) => {
    const selectedIds = mealType === 'breakfast'
      ? (freeMealPicks[mealType] ? [freeMealPicks[mealType]] : [])
      : (freeMealPicks[mealType] || []);

    const riceIds = selectedIds.filter(id => {
      const recipe = freeRecipes.find(r => r._id === id);
      return recipe && isWhiteRiceRecipeName(recipe.name);
    });

    const nonRiceIds = selectedIds.filter(id => {
      const recipe = freeRecipes.find(r => r._id === id);
      return recipe && !isWhiteRiceRecipeName(recipe.name);
    });

    return { riceIds, nonRiceIds };
  };

  const renderManualMealPicker = ({ subtitle, badgeText, showUpsell }) => {

    return (
      <div className="today-menu">
        <div className="menu-card">
          <div className="menu-card-header">
            <div>
              <h2 className="menu-title">Thực đơn hôm nay</h2>
              <p className="menu-subtitle">{subtitle}</p>
            </div>
            <div className="day-badge">{badgeText}</div>
          </div>

          <div className="meals-container">
            {MEAL_TYPES.map(mealType => {
              const selectedRecipeIds = mealType === 'breakfast' 
                ? (freeMealPicks[mealType] ? [freeMealPicks[mealType]] : [])
                : (freeMealPicks[mealType] || []);

              let canAddMore = false;
              let maxSelectionsDisplay = 1;

              if (mealType === 'breakfast') {
                canAddMore = selectedRecipeIds.length === 0;
                maxSelectionsDisplay = 1;
              } else {
                // lunch/dinner: max 5 non-rice + 1 rice
                const { riceIds, nonRiceIds } = getSelectedRiceAndNonRice(mealType);
                canAddMore = nonRiceIds.length < 5 || riceIds.length === 0;
                maxSelectionsDisplay = 6; // 5 non-rice + 1 rice
              }

              return (
                <div key={mealType} className={`meal-card ${MEAL_CARD_CLASS[mealType]}`}>
                  <div className="meal-card-header-custom">
                    <span className={`meal-label ${MEAL_LABEL_CLASS[mealType]}`}>
                      {MEAL_LABELS[mealType]}
                    </span>
                    <span className="meal-selection-count">
                      {selectedRecipeIds.length}/{maxSelectionsDisplay}
                    </span>
                  </div>

                  {selectedRecipeIds.length > 0 ? (
                    <div className="combo-meals-list manual-combo-meals-list">
                      {selectedRecipeIds.map((recipeId, idx) => {
                        const recipe = freeRecipes.find(r => r._id === recipeId);
                        if (!recipe) return null;
                        return (
                          <div key={idx} className="combo-meal-wrapper manual-combo-meal-wrapper">
                            <div className="combo-meal-item manual-combo-meal-item">
                              <span className="meal-bullet">•</span>
                              <div
                                className="meal-text manual-meal-text"
                                onClick={() => handleRecipeClick(recipe._id)}
                              >
                                {recipe.name}
                              </div>
                              {!manualDayLocked && (
                                <button
                                  className="btn-remove-inline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleFreeMealPick(mealType, recipeId, false);
                                  }}
                                  title="Xóa món"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                            <div className="item-nutrition-text">
                              {recipe.calories} kcal, {recipe.protein}g đạm
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="no-meal-selected">Chưa chọn món</p>
                  )}

                  {canAddMore && !manualDayLocked && (
                    <button
                      className="btn-add-meal"
                      onClick={() => setOpenMealModal(mealType)}
                    >
                      + Thêm món
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {openMealModal && (
            <MealSelectorModal
              isOpen={true}
              mealType={openMealModal}
              availableRecipes={getAvailableRecipesForMeal()}
              selectedRecipeIds={
                openMealModal === 'breakfast'
                  ? (freeMealPicks[openMealModal] ? [freeMealPicks[openMealModal]] : [])
                  : (freeMealPicks[openMealModal] || [])
              }
              onSelect={(recipeId, isAdding, isRice) => handleFreeMealPick(openMealModal, recipeId, isAdding, isRice)}
              onClose={() => setOpenMealModal(null)}
              maxSelections={6}
              isLocked={manualDayLocked}
            />
          )}

          {showUpsell ? (
            <div className="free-upsell-banner">
              <p>🌟 Nâng cấp Premium để nhận lộ trình AI cá nhân hóa</p>
              <button className="btn-upgrade-premium" onClick={() => navigate('/plan-price')}>
                Nâng cấp ngay →
              </button>
            </div>
          ) : null}

          {!manualDayLocked && (
            <button
              className={`manual-day-confirm-btn manual-day-confirm-btn-standalone ${manualDaySaved ? 'saved' : ''}`}
              type="button"
              disabled={!isManualDayComplete || manualDaySaving || manualDaySaved}
              onClick={handleConfirmManualDayMenu}
            >
              {manualDaySaving
                ? 'Đang lưu...'
                : manualDaySaved
                  ? 'Đã lưu thực đơn ngày'
                  : 'Xác nhận lưu thực đơn ngày'}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Free user mode: manual meal picker from 10 free recipes ──
  if (!isTrulyPremium) {
    return renderManualMealPicker({
      subtitle: '',
      badgeText: 'Cơ bản',
      showUpsell: false
    });
  }

  // ── Premium user: future day without generated meal ──
  if (allowManualPickForFutureNoMeal) {
    return renderManualMealPicker({
      subtitle: '',
      badgeText: 'Tự chọn',
      showUpsell: false
    });
  }

  // ── Premium user: no plan yet ──
  if (!mealPlan) {
    return (
      <div className="today-menu">
        <div className="menu-card">
          <div className="no-plan">
            <p className="title">Chưa có lộ trình</p>
            <p className="description">Hãy tạo lộ trình ăn chay cá nhân hóa để bắt đầu hành trình của bạn!</p>
            <button
              className="btn-create-plan"
              onClick={() => navigate('/generate-plan')}
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

  const isSelectedDateToday = selectedDateValue.toDateString() === new Date().toDateString();
  const streakMeals = streakStatus?.meals || {};

  const renderMealAction = (mealType) => {
    if (!isSelectedDateToday) {
      return null;
    }

    const mealStatus = streakMeals?.[mealType];

    if (!mealStatus?.available) {
      return null;
    }

    return (
      <div className="meal-confirmation-panel">
        <div className="meal-confirmation-meta">
          <span className="meal-confirmation-window">
            Xác nhận từ {mealStatus.windowStart} đến {mealStatus.windowEnd}
          </span>
        </div>

        <button
          type="button"
          className={`meal-confirmation-button ${mealStatus.confirmed ? 'confirmed' : ''}`}
          disabled={Boolean(confirmingMeal) || mealStatus.confirmed || !mealStatus.canConfirm}
          onClick={() => onConfirmMeal(mealType)}
        >
          {confirmingMeal === mealType ? 'Đang lưu...' : mealStatus.confirmed ? 'Đã hoàn thành' : 'Xác nhận hoàn thành'}
        </button>
      </div>
    );
  };

  return (
    <div className="today-menu">
      <div className="menu-card">
        <div className="menu-card-header">
          <div>
            <h2 className="menu-title">Thực đơn hôm nay</h2>
            <p className="menu-subtitle">Dựa trên lộ trình &quot;{mealPlan.dietType === 'vegan' ? 'Ăn chay' : 'Healthy'}&quot; của bạn</p>
          </div>
        </div>

        <div className="meals-container">
          {/* Breakfast */}
          {todayMeal.breakfast && (
            <div className="meal-card breakfast-card">
              <span className="meal-label breakfast-label">BỮA SÁNG</span>
              {todayMeal.breakfast.items ? (
                <div className="combo-meals-list">
                  {todayMeal.breakfast.items.map((item, idx) => (
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
              )}
              {renderMealAction('breakfast')}
            </div>
          )}

          {/* Lunch */}
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
              {renderMealAction('lunch')}
            </div>
          )}

          {/* Dinner */}
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
              {renderMealAction('dinner')}
            </div>
          )}
        </div>

        <div className="todaymenu-premium-mobile-action">
          <button
            className="btn-create-plan"
            onClick={() => navigate('/generate-plan')}
          >
            Tạo lộ trình mới
          </button>
        </div>
      </div>
    </div>
  );
};

TodayMenu.propTypes = {
  mealPlan: PropTypes.object,
  todayMeal: PropTypes.object,
  loading: PropTypes.bool,
  subscriptionInfo: PropTypes.object,
  selectedDate: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  streakStatus: PropTypes.object,
  confirmingMeal: PropTypes.string,
  onConfirmMeal: PropTypes.func,
  onManualNutritionChange: PropTypes.func
};

export default TodayMenu;
