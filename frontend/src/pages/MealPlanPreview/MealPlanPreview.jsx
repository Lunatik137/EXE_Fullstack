import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import './MealPlanPreview.css';

const SKIPPED_MEAL_PLAN_IDS_KEY = 'skippedMealPlanIds';

const readSkippedMealPlanIds = () => {
  try {
    const raw = localStorage.getItem(SKIPPED_MEAL_PLAN_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
};

const writeSkippedMealPlanIds = (ids) => {
  const normalized = [...new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean))];
  localStorage.setItem(SKIPPED_MEAL_PLAN_IDS_KEY, JSON.stringify(normalized));
  return normalized;
};

const clearSkippedMealPlanIds = () => {
  localStorage.removeItem(SKIPPED_MEAL_PLAN_IDS_KEY);
};

const MealPlanPreview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { url, token } = useContext(StoreContext);
  const [loading, setLoading] = useState(true);
  const [mealPlan, setMealPlan] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [skippedMealPlanIds, setSkippedMealPlanIds] = useState(() => readSkippedMealPlanIds());
  const { planType, duration } = location.state || {};
  const displayDuration = mealPlan?.duration || duration;
  const minLoadingSecondsRef = useRef(10 + Math.floor(Math.random() * 3));
  const pendingMealPlanRef = useRef(null);

  // Timer for loading message
  useEffect(() => {
    if (!loading) return;
    
    const timer = setInterval(() => {
      setLoadingSeconds(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [loading]);

  // Reveal plan only after minimum loading time
  useEffect(() => {
    if (!loading || !pendingMealPlanRef.current) return;
    if (loadingSeconds >= minLoadingSecondsRef.current) {
      const plan = pendingMealPlanRef.current;
      pendingMealPlanRef.current = null;
      setMealPlan(plan);
      setLoadingSeconds(0);
      setLoading(false);
    }
  }, [loading, loadingSeconds]);



  const handlePrevWeek = () => {
    if (currentWeek > 0) {
      setCurrentWeek(currentWeek - 1);
    }
  };

  const handleNextWeek = () => {
    const totalWeeks = Math.ceil(mealPlan.days.length / 7);
    if (currentWeek < totalWeeks - 1) {
      setCurrentWeek(currentWeek + 1);
    }
  };

  const getCurrentWeekDays = () => {
    const startIndex = currentWeek * 7;
    const endIndex = Math.min(startIndex + 7, mealPlan.days.length);
    return mealPlan.days.slice(startIndex, endIndex);
  };

  const fetchDraftMealPlan = useCallback(async () => {
    console.log('🟥 FETCH DRAFT CALLED - START');
    console.log('   token:', token ? 'YES' : 'NO');
    console.log('   url:', url);
    setLoading(true);
    try {
      console.log('🔍 Fetching draft meal plan...');
      console.log('📤 URL:', `${url}/api/meal-plan/get-draft`);
      console.log('📤 Token:', token ? `Present (${token.substring(0, 20)}...)` : 'MISSING');
      
      const response = await axios.post(
        `${url}/api/meal-plan/get-draft`,
        {},
        { headers: { token } }
      );

      console.log('📦 Response status:', response.status);
      console.log('📦 Response data:', response.data);
      
      if (response.data.success) {
        console.log('✅ Draft meal plan found');
        console.log('📊 Days:', response.data.mealPlan.days.length);
        console.log('📊 Plan type:', response.data.mealPlan.planType);
        console.log('📊 Status:', response.data.mealPlan.status);
        // Save draft info to localStorage
        const draftInfo = {
          mealPlanId: response.data.mealPlan._id,
          planType: response.data.mealPlan.planType,
          duration: response.data.mealPlan.duration,
          status: response.data.mealPlan.status
        };
        localStorage.setItem('draftMealPlan', JSON.stringify(draftInfo));
        console.log('💾 Draft plan saved to localStorage:', draftInfo);
        setMealPlan(response.data.mealPlan);
        setLoading(false);
      } else {
        console.log('❌ API returned success: false');
        console.log('📋 Message:', response.data.message);
        setLoading(false);
        toast.error(response.data.message || 'Không tìm thấy lộ trình');
        navigate('/home', { replace: true });
      }
    } catch (error) {
      console.error('❌ Axios error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      setLoading(false);
      toast.error('Lỗi khi tải lộ trình');
      navigate('/home', { replace: true });
    }
  }, [navigate, token, url]);

  const generateMealPlan = useCallback(async ({
    planTypeOverride,
    skipSimilarityLookup = false,
    excludeMealPlanIds = []
  } = {}) => {
    const persistedSkippedIds = readSkippedMealPlanIds();
    const mergedExcludedIds = [...new Set([...persistedSkippedIds, ...(excludeMealPlanIds || [])].filter(Boolean))];

    minLoadingSecondsRef.current = 10 + Math.floor(Math.random() * 3);
    pendingMealPlanRef.current = null;

    setLoading(true);
    let succeeded = false;
    try {
      console.log('🔄 Generating NEW meal plan...');
      console.log('📤 POST /api/meal-plan/generate');
      console.log('📦 Body:', {
        planType: planTypeOverride,
        skipSimilarityLookup,
        excludeMealPlanIds: mergedExcludedIds
      });
      
      const response = await axios.post(
        `${url}/api/meal-plan/generate`,
        {
          planType: planTypeOverride,
          skipSimilarityLookup,
          excludeMealPlanIds: mergedExcludedIds
        },
        { headers: { token } }
      );

      console.log('📥 Response:', response.data);

      if (response.data.success) {
        console.log('✅ Meal plan generated successfully');
        // Save draft info to localStorage
        const draftInfo = {
          mealPlanId: response.data.mealPlan._id,
          planType: response.data.mealPlan.planType,
          duration: response.data.mealPlan.duration,
          status: response.data.mealPlan.status
        };
        localStorage.setItem('draftMealPlan', JSON.stringify(draftInfo));
        console.log('💾 Draft plan saved to localStorage:', draftInfo);
        // Hold result until minimum loading time is reached
        pendingMealPlanRef.current = response.data.mealPlan;
        succeeded = true;
      } else {
        console.log('❌ generateMealPlan failed: success is false');
        console.log('📋 Message:', response.data.message);
        toast.error(response.data.message);
        console.log('🔴 REDIRECTING to /home');
        navigate('/home');
      }
    } catch (error) {
      console.error('❌ generateMealPlan AXIOS ERROR:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // Show more specific error messages
      let errorMessage = 'Không thể tạo lộ trình. Vui lòng thử lại!';
      
      if (error.message === 'Network Error' || error.code === 'ECONNABORTED') {
        errorMessage = 'Kết nối quá chậm. Vui lòng kiểm tra kết nối internet và thử lại.';
      } else if (error.response?.data?.message?.includes('timeout')) {
        errorMessage = 'Yêu cầu quá lâu. Vui lòng thử lại sau vài phút.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
      console.log('🔴 REDIRECTING to /home (error)');
      navigate('/home');
    } finally {
      // Only stop loading immediately on error; success waits for minimum time
      if (!succeeded) setLoading(false);
    }
  }, [navigate, token, url]);

  useEffect(() => {
    if (planType || duration) {
      // Arrived here from App.jsx draft recovery (has location.state) — show existing draft
      console.log('🟦 Has state — fetching existing draft...');
      fetchDraftMealPlan();
    } else {
      // Fresh button click — no state — generate a brand new plan
      console.log('🟩 No state — generating new meal plan...');
      generateMealPlan();
    }
  }, [planType, duration, fetchDraftMealPlan, generateMealPlan]);

  const handleConfirm = async () => {
    try {
      console.log('🔵 handleConfirm - mealPlan:', mealPlan);
      console.log('🔵 mealPlan._id:', mealPlan._id);
      
      const response = await axios.post(
        `${url}/api/meal-plan/confirm`,
        { mealPlanId: mealPlan._id },
        { headers: { token } }
      );

      console.log('Response from confirm:', response.data);

      if (response.data.success) {
        console.log('✅ Meal plan confirmed successfully');
        // Clear draft from localStorage after confirmation
        localStorage.removeItem('draftMealPlan');
        clearSkippedMealPlanIds();
        setSkippedMealPlanIds([]);
        console.log('🗑️ Cleared draftMealPlan from localStorage');
        toast.success('Lộ trình đã được kích hoạt!');
        navigate('/home');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error('Error confirming meal plan:', error);
      toast.error('Đã có lỗi xảy ra!');
    }
  };

  const handleRegenerate = async () => {
    console.log('🔄 Regenerating meal plan - clearing old draft');

    const nextSkippedIds = writeSkippedMealPlanIds([
      ...skippedMealPlanIds,
      mealPlan?._id,
      mealPlan?.similarSourcePlanId
    ]);
    setSkippedMealPlanIds(nextSkippedIds);

    try {
      await axios.post(
        `${url}/api/meal-plan/clear-draft`,
        {},
        { headers: { token } }
      );
    } catch (error) {
      console.log('Could not clear draft before regenerating, continuing anyway');
    }

    localStorage.removeItem('draftMealPlan');
    toast.info('Đang tạo lộ trình mới...');
    generateMealPlan({
      planTypeOverride: mealPlan?.planType,
      skipSimilarityLookup: false,
      excludeMealPlanIds: nextSkippedIds
    });
  };

  if (loading) {
    return (
      <div className="meal-plan-preview-container loading-active">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>AI đang tạo lộ trình cho bạn...</h2>
          <p>Vui lòng đợi trong giây lát ({loadingSeconds}s)</p>
          <div className="loading-tips">
            <p>Chúng tôi đang phân tích thông tin của bạn</p>
            <p>Lựa chọn các món ăn phù hợp nhất</p>
            <p>Tính toán dinh dưỡng cân đối</p>
            {loadingSeconds > 20 && (
              <p style={{ color: '#ff9800', marginTop: '1rem' }}>⏱️ Yêu cầu đang mất thời gian hơn dự kiến. Vui lòng đợi thêm...</p>
            )}
          </div>
          <button
            className="btn-secondary"
            style={{ marginTop: '24px' }}
            onClick={async () => {
              pendingMealPlanRef.current = null;
              localStorage.removeItem('draftMealPlan');
              clearSkippedMealPlanIds();
              try {
                await axios.post(`${url}/api/meal-plan/clear-draft`, {}, { headers: { token } });
              } catch (e) {
                // ignore, navigate anyway
              }
              navigate('/home');
            }}
          >
            ← Huỷ
          </button>
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
          <h1>Lộ trình của bạn đã sẵn sàng!</h1>
          <p>Xem trước và xác nhận lộ trình {displayDuration} ngày</p>
        </div>

        {/* Plan Summary */}
        <div className="plan-summary">
          <div className="summary-card">
            <span className="summary-icon">📅</span>
            <div>
              <h3>{displayDuration} ngày</h3>
              <p>Thời lượng</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🍽️</span>
            <div>
              <h3>{(displayDuration || 0) * 3} bữa</h3>
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
        <div className="week-navigation-header">
          <div className="week-title">
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', margin: '0' }}>
              🗓️ Tuần {currentWeek + 1}
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', margin: '4px 0 0' }}>
              Ngày {currentWeek * 7 + 1} đến {Math.min((currentWeek + 1) * 7, mealPlan.days.length)}
            </p>
          </div>
          <div className="week-navigation-buttons">
            <button 
              className="week-nav-btn" 
              onClick={handlePrevWeek}
              disabled={currentWeek === 0}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button 
              className="week-nav-btn" 
              onClick={handleNextWeek}
              disabled={currentWeek >= Math.ceil(mealPlan.days.length / 7) - 1}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
        
        <div className="days-preview">
          {getCurrentWeekDays().map((day, index) => (
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
                  {day.breakfast?.items ? (
                    <>
                      <div className="combo-items-list">
                        {day.breakfast.items.map((item, idx) => (
                          <p key={idx} className="combo-item">{item.name}</p>
                        ))}
                      </div>
                      <div className="meal-macros">
                        <span>🔥 {day.breakfast.totalCalories} kcal</span>
                        <span>🥩 {day.breakfast.totalProtein}g protein</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="combo-items-list">
                        <p className="combo-item">{day.breakfast?.name}</p>
                      </div>
                      <div className="meal-macros">
                        <span>🔥 {day.breakfast?.calories} kcal</span>
                        <span>🥩 {day.breakfast?.protein}g protein</span>
                      </div>
                    </>
                  )}
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
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className="btn-secondary" 
            onClick={async () => {
              localStorage.removeItem('draftMealPlan');
              clearSkippedMealPlanIds();
              setSkippedMealPlanIds([]);
              try {
                await axios.post(`${url}/api/meal-plan/clear-draft`, {}, { headers: { token } });
              } catch (e) {
                // ignore, navigate anyway
              }
              navigate('/home');
            }}
          >
            ← Huỷ
          </button>
          <button className="btn-regenerate" onClick={handleRegenerate}>
            Tạo lộ trình khác
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
