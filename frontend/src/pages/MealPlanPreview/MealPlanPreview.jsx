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
  const { url, token, nutritionTargets } = useContext(StoreContext);
  const [loading, setLoading] = useState(true);
  const [mealPlan, setMealPlan] = useState(null);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [skippedMealPlanIds, setSkippedMealPlanIds] = useState(() => readSkippedMealPlanIds());
  const { planType, duration, mode } = location.state || {};
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
    if (mode === 'generate') {
      console.log('Generate mode state - generating new meal plan...');
      generateMealPlan({ planTypeOverride: planType });
    } else if (planType || duration) {
      // Arrived here from App.jsx draft recovery (has location.state) — show existing draft
      console.log('🟦 Has state — fetching existing draft...');
      fetchDraftMealPlan();
    } else {
      // Fresh button click — no state — generate a brand new plan
      console.log('🟩 No state — generating new meal plan...');
      generateMealPlan();
    }
  }, [planType, duration, mode, fetchDraftMealPlan, generateMealPlan]);

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

  const previewDay = mealPlan.days?.[0] || null;
  const getMealCalories = (meal) => {
    if (!meal) return 0;
    if (meal.totalCalories != null) return Number(meal.totalCalories || 0);
    return Number(meal.calories || 0);
  };

  const getMealProtein = (meal) => {
    if (!meal) return 0;
    if (meal.totalProtein != null) return Number(meal.totalProtein || 0);
    return Number(meal.protein || 0);
  };

  const getMealMetric = (meal, totalField, fallbackField) => {
    if (!meal) return 0;
    if (meal[totalField] != null) return Number(meal[totalField] || 0);
    return Number(meal[fallbackField] || 0);
  };

  const totalProtein = previewDay
    ? Math.round((getMealProtein(previewDay.breakfast) + getMealProtein(previewDay.lunch) + getMealProtein(previewDay.dinner)) * 10) / 10
    : 0;

  const totalFat = previewDay
    ? Math.round((
      getMealMetric(previewDay.breakfast, 'totalFat', 'fat') +
      getMealMetric(previewDay.lunch, 'totalFat', 'fat') +
      getMealMetric(previewDay.dinner, 'totalFat', 'fat')
    ) * 10) / 10
    : 0;

  const totalCarbs = previewDay
    ? Math.round((
      getMealMetric(previewDay.breakfast, 'totalCarbs', 'carbs') +
      getMealMetric(previewDay.lunch, 'totalCarbs', 'carbs') +
      getMealMetric(previewDay.dinner, 'totalCarbs', 'carbs')
    ) * 10) / 10
    : 0;

  const totalFiber = previewDay
    ? Math.round((
      getMealMetric(previewDay.breakfast, 'totalFiber', 'fiber') +
      getMealMetric(previewDay.lunch, 'totalFiber', 'fiber') +
      getMealMetric(previewDay.dinner, 'totalFiber', 'fiber')
    ) * 10) / 10
    : 0;

  const totalCalories = previewDay
    ? Math.round(
      Number(previewDay.totalCalories || 0) ||
      (getMealCalories(previewDay.breakfast) + getMealCalories(previewDay.lunch) + getMealCalories(previewDay.dinner))
    )
    : Math.round(Number(mealPlan.avgCalories || 0));

  const macroTargets = {
    protein: nutritionTargets?.protein || 100,
    fat: nutritionTargets?.fat || 65,
    carbs: nutritionTargets?.carbs || 250,
    fiber: nutritionTargets?.fiber || 30
  };

  const macroProgressRows = [
    {
      key: 'protein',
      label: 'Protein',
      value: totalProtein,
      target: macroTargets.protein,
      unit: 'g',
      className: 'macro-row-protein'
    },
    {
      key: 'fat',
      label: 'Fat',
      value: totalFat,
      target: macroTargets.fat,
      unit: 'g',
      className: 'macro-row-fat'
    },
    {
      key: 'carbs',
      label: 'Carbs',
      value: totalCarbs,
      target: macroTargets.carbs,
      unit: 'g',
      className: 'macro-row-carbs'
    },
    {
      key: 'fiber',
      label: 'Fiber',
      value: totalFiber,
      target: macroTargets.fiber,
      unit: 'g',
      className: 'macro-row-fiber'
    }
  ].map((row) => {
    const percent = Math.max(0, Math.round((Number(row.value || 0) / Number(row.target || 1)) * 100));
    const barPercent = Math.min(100, percent);
    return { ...row, percent, barPercent };
  });

  return (
    <div className="meal-plan-preview-container">
      <div className="meal-plan-preview-content">
        <div className="preview-header">
          <h1>Thực đơn hôm nay đã sẵn sàng</h1>
          <p>Kế hoạch ăn chay cá nhân hóa cho riêng bạn</p>
        </div>

        <div className="nutrition-overview">
          <div className="nutrition-overview-header">
            <h2>Tổng quan dinh dưỡng</h2>
            <p>Chỉ số dinh dưỡng cho thực đơn hôm nay</p>
          </div>
          <div className="nutrition-grid">
            <div className="nutrition-card nutrition-card-primary nutrition-card-calories">
              <span className="nutrition-icon-badge nutrition-icon-calories">
                <span className="nutrition-icon">⚡</span>
              </span>
              <strong className="nutrition-value">{totalCalories || '~1800'} kcal</strong>
              <span className="nutrition-label">Tổng năng lượng</span>
            </div>
            <div className="nutrition-card nutrition-card-protein">
              <span className="nutrition-icon-badge nutrition-icon-protein">
                <span className="nutrition-icon">💪</span>
              </span>
              <strong className="nutrition-value">{totalProtein || '~0'}g</strong>
              <span className="nutrition-label">Protein</span>
            </div>
            <div className="nutrition-card nutrition-card-fat">
              <span className="nutrition-icon-badge nutrition-icon-fat">
                <span className="nutrition-icon">🥑</span>
              </span>
              <strong className="nutrition-value">{totalFat || '~0'}g</strong>
              <span className="nutrition-label">Chất béo</span>
            </div>
            <div className="nutrition-card nutrition-card-carbs">
              <span className="nutrition-icon-badge nutrition-icon-carbs">
                <span className="nutrition-icon">🌾</span>
              </span>
              <strong className="nutrition-value">{totalCarbs || '~0'}g</strong>
              <span className="nutrition-label">Carbs</span>
            </div>
            <div className="nutrition-card nutrition-card-fiber">
              <span className="nutrition-icon-badge nutrition-icon-fiber">
                <span className="nutrition-icon">🌿</span>
              </span>
              <strong className="nutrition-value">{totalFiber || '~0'}g</strong>
              <span className="nutrition-label">Chất xơ</span>
            </div>
          </div>

          <div className="macro-progress-panel" aria-label="Macro progress today">
            {macroProgressRows.map((row) => (
              <div key={row.key} className={`macro-progress-row ${row.className}`}>
                <div className="macro-progress-meta">
                  <span className="macro-progress-label">{row.label}</span>
                  <span className="macro-progress-value">
                    {row.value || 0}{row.unit} · {row.percent}%
                  </span>
                </div>
                <div className="macro-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(row.percent, 100)}>
                  <span className="macro-progress-fill" style={{ width: `${row.barPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="days-preview">
          {previewDay && (
            <div className="day-card">
              <div className="day-header">
                <h3>Hôm nay</h3>
              </div>
              
              <div className="meals-grid">
                {/* Breakfast */}
                <div className="meal-item breakfast emphasis-card">
                  <div className="meal-header">
                    <span className="meal-icon">🌅</span>
                    <strong>Bữa sáng</strong>
                  </div>
                  {previewDay.breakfast?.items ? (
                    <>
                      <div className="combo-items-list">
                        {previewDay.breakfast.items.map((item, idx) => (
                          <p key={idx} className="combo-item">{item.name}</p>
                        ))}
                      </div>
                      <div className="meal-macros">
                        <span>🔥 {getMealCalories(previewDay.breakfast)} kcal</span>
                        <span>🥩 {getMealProtein(previewDay.breakfast)}g protein</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="combo-items-list">
                        <p className="combo-item">{previewDay.breakfast?.name}</p>
                      </div>
                      <div className="meal-macros">
                        <span>🔥 {getMealCalories(previewDay.breakfast)} kcal</span>
                        <span>🥩 {getMealProtein(previewDay.breakfast)}g protein</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Lunch - Combo Meal */}
                <div className="meal-item lunch emphasis-card">
                  <div className="meal-header">
                    <span className="meal-icon">☀️</span>
                    <strong>Bữa trưa</strong>
                  </div>
                  {previewDay.lunch?.items ? (
                    <>
                      <div className="combo-items-list">
                        {previewDay.lunch.items.map((item, idx) => (
                          <p key={idx} className="combo-item">
                            {item.isRice ? `${item.name}` : item.name}
                          </p>
                        ))}
                      </div>
                      <div className="meal-macros">
                        <span>🔥 {getMealCalories(previewDay.lunch)} kcal</span>
                        <span>🥩 {getMealProtein(previewDay.lunch)}g protein</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="meal-name">{previewDay.lunch.name}</p>
                      <div className="meal-macros">
                        <span>🔥 {getMealCalories(previewDay.lunch)} kcal</span>
                        <span>🥩 {getMealProtein(previewDay.lunch)}g protein</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Dinner - Combo Meal */}
                <div className="meal-item dinner emphasis-card">
                  <div className="meal-header">
                    <span className="meal-icon">🌙</span>
                    <strong>Bữa tối</strong>
                  </div>
                  {previewDay.dinner?.items ? (
                    <>
                      <div className="combo-items-list">
                        {previewDay.dinner.items.map((item, idx) => (
                          <p key={idx} className="combo-item">
                            {item.isRice ? `${item.name}` : item.name}
                          </p>
                        ))}
                      </div>
                      <div className="meal-macros">
                        <span>🔥 {getMealCalories(previewDay.dinner)} kcal</span>
                        <span>🥩 {getMealProtein(previewDay.dinner)}g protein</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="meal-name">{previewDay.dinner.name}</p>
                      <div className="meal-macros">
                        <span>🔥 {getMealCalories(previewDay.dinner)} kcal</span>
                        <span>🥩 {getMealProtein(previewDay.dinner)}g protein</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
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
            Tạo thực đơn khác
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
