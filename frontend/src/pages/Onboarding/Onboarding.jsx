import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Onboarding.css';

// Calculate personalized nutrition targets (Mifflin-St Jeor — matches backend)
const calculateNutritionTargets = ({ age, gender, height, weight, activityLevel, goal, targetWeight, targetDuration }) => {
  const w = parseFloat(weight) || 70;
  const h = parseFloat(height) || 170;
  const a = parseFloat(age) || 25;
  const normalizedGender = String(gender || '').trim().toLowerCase();
  const normalizedGoal = String(goal || '').trim().toLowerCase();

  let bmr;
  if (normalizedGender === 'male') {
    bmr = 10 * w + 6.25 * h - 5 * a + 5;
  } else if (normalizedGender === 'female') {
    bmr = 10 * w + 6.25 * h - 5 * a - 161;
  } else {
    bmr = 10 * w + 6.25 * h - 5 * a - 78; // average
  }

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const tdee = Math.round(bmr * (multipliers[activityLevel] || 1.375));
  let calories = tdee;

  const parseDurationToWeeks = (d) => {
    if (!d) return 12;
    const val = parseFloat(d);
    if (isNaN(val) || val <= 0) return 12;
    if (d.endsWith('y')) return val * 52;
    if (d.endsWith('m')) return val * 4.33;
    if (d.endsWith('w')) return val;
    return 12;
  };

  if (normalizedGoal === 'lose') {
    if (targetWeight && targetDuration) {
      const weeks = parseDurationToWeeks(targetDuration);
      const dailyDeficit = Math.round((parseFloat(targetWeight) / weeks * 7700) / 7);
      calories = Math.max(1200, tdee - dailyDeficit);
    } else {
      calories = Math.max(1200, tdee - 500);
    }
  } else if (normalizedGoal === 'gain') {
    if (targetWeight && targetDuration) {
      const weeks = parseDurationToWeeks(targetDuration);
      const dailySurplus = Math.round((parseFloat(targetWeight) / weeks * 7700) / 7);
      calories = tdee + dailySurplus;
    } else {
      calories = tdee + 300;
    }
  }

  const proteinFactor = normalizedGoal === 'lose' ? 1.4 : normalizedGoal === 'gain' ? 1.4 : 1.2;
  const protein = Math.round(w * proteinFactor);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.round(Math.max(calories - protein * 4 - fat * 9, 0) / 4);
  const fiber = Math.max(25, Math.round((calories / 1000) * 14));

  return { tdee, calories, protein, fat, carbs, fiber };
};

const Onboarding = () => {
  const { url, token, setToken, setHasCompletedOnboarding, setNutritionTargets } = useContext(StoreContext);
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1 - Basic Info
    name: '',
    age: '',
    gender: '',
    
    // Step 2 - Body
    height: '',
    weight: '',
    
    // Step 3 - Goals
    goal: '',
    targetWeight: '',
    targetDuration: '',
    
    // Step 4 - Health
    healthConditions: [],
    healthConditionsOther: '',
    
    // Step 5 - Diet
    dietType: '',
    dietTypeOther: '',
    
    // Step 6 - Allergies
    allergies: [],
    allergiesOther: '',
    dislikes: '',
    
    // Step 7 - Activity
    activityLevel: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiSelect = (name, value) => {
    setFormData(prev => {
      const currentValues = prev[name] || [];
      
      // Special handling for health conditions: "normal" is mutually exclusive
      if (name === 'healthConditions') {
        if (value === 'normal') {
          // If selecting "normal", clear all other selections
          return { ...prev, [name]: ['normal'] };
        } else {
          // If selecting any other condition, remove "normal" if it exists
          const filteredValues = currentValues.filter(v => v !== 'normal');
          if (filteredValues.includes(value)) {
            const nextValues = filteredValues.filter(v => v !== value);
            // Auto-fallback to "normal" when no specific condition is selected.
            return { ...prev, [name]: nextValues.length ? nextValues : ['normal'] };
          } else {
            return { ...prev, [name]: [...filteredValues, value] };
          }
        }
      }
      
      // Default behavior for other multi-selects
      if (currentValues.includes(value)) {
        return { ...prev, [name]: currentValues.filter(v => v !== value) };
      } else {
        return { ...prev, [name]: [...currentValues, value] };
      }
    });
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.name || !formData.age || !formData.gender) {
          toast.error('Vui lòng điền đầy đủ thông tin!');
          return false;
        }
        return true;
      case 2:
        if (!formData.height || !formData.weight) {
          toast.error('Vui lòng điền đầy đủ thông tin!');
          return false;
        }
        return true;
      case 3:
        if (!formData.goal) {
          toast.error('Vui lòng chọn mục tiêu!');
          return false;
        }
        if ((formData.goal === 'Lose' || formData.goal === 'Gain') && !formData.targetWeight) {
          toast.error('Vui lòng nhập số kg bạn muốn thay đổi!');
          return false;
        }
        return true;
      case 4:
        return true; // Optional step
      case 5:
        if (!formData.dietType) {
          toast.error('Vui lòng chọn chế độ ăn!');
          return false;
        }
        return true;
      case 6:
        return true; // Optional step
      case 7:
        if (!formData.activityLevel) {
          toast.error('Vui lòng chọn mức độ hoạt động!');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < 9) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  useEffect(() => {
    if (currentStep === 4 && (!formData.healthConditions || formData.healthConditions.length === 0)) {
      setFormData(prev => ({ ...prev, healthConditions: ['normal'] }));
    }
  }, [currentStep, formData.healthConditions]);

  const handleSubmit = async () => {
    if (!validateStep()) return;

    try {
      const response = await axios.post(
        `${url}/api/user/onboarding`,
        formData,
        { headers: { token } }
      );

      if (response.data.success) {
        // Save nutrition targets to context immediately (without page reload)
        setNutritionTargets(calculateNutritionTargets(formData));
        // Update onboarding status in localStorage and context
        localStorage.setItem('hasCompletedOnboarding', 'true');
        setHasCompletedOnboarding(true);
        
        toast.success('Hoàn thành onboarding! Chào mừng bạn về trang chủ.');
        navigate('/home');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Đã có lỗi xảy ra. Vui lòng thử lại!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('hasCompletedOnboarding');
    setToken('');
    setHasCompletedOnboarding(true);
    toast.success('Đăng xuất thành công');
    navigate('/');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="onboarding-step">
            <h2 className="step-title">Thông tin cơ bản</h2>
            <div className="form-group">
              <label>Tên *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Nhập tên của bạn"
                required
              />
            </div>
            <div className="form-group">
              <label>Tuổi *</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                placeholder="Nhập tuổi"
                min="10"
                max="90"
                required
              />
            </div>
            <div className="form-group">
              <label>Giới tính *</label>
              <div className="radio-group">
                {['Male', 'Female', 'Other', 'Prefer not to say'].map(option => (
                  <label key={option} className="radio-label">
                    <input
                      type="radio"
                      name="gender"
                      value={option}
                      checked={formData.gender === option}
                      onChange={handleInputChange}
                    />
                    <span>{option === 'Male' ? 'Nam' : option === 'Female' ? 'Nữ' : option === 'Other' ? 'Khác' : 'Không muốn tiết lộ'}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="onboarding-step">
            <h2 className="step-title">Cơ thể</h2>
            <div className="form-group">
              <label>Chiều cao (cm) *</label>
              <input
                type="number"
                name="height"
                value={formData.height}
                onChange={handleInputChange}
                placeholder="Nhập chiều cao"
                min="100"
                max="230"
                required
              />
            </div>
            <div className="form-group">
              <label>Cân nặng (kg) *</label>
              <input
                type="number"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                placeholder="Nhập cân nặng"
                min="25"
                max="250"
                required
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="onboarding-step">
            <h2 className="step-title">Mục tiêu</h2>
            <div className="form-group">
              <label>Mục tiêu của bạn *</label>
              <div className="radio-group">
                {[
                  { value: 'Maintain', label: 'Duy trì' },
                  { value: 'Lose', label: 'Giảm cân' },
                  { value: 'Gain', label: 'Tăng cân' }
                ].map(option => (
                  <label key={option.value} className="radio-label">
                    <input
                      type="radio"
                      name="goal"
                      value={option.value}
                      checked={formData.goal === option.value}
                      onChange={handleInputChange}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {(formData.goal === 'Lose' || formData.goal === 'Gain') && (
              <>
                <div className="form-group">
                  <label>Bạn muốn {formData.goal === 'Lose' ? 'giảm' : 'tăng'} bao nhiêu kg? *</label>
                  <input
                    type="number"
                    name="targetWeight"
                    value={formData.targetWeight}
                    onChange={handleInputChange}
                    placeholder="Nhập số kg"
                    min="1"
                    max="50"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Trong bao lâu?</label>
                  <div className="radio-group">
                    {[
                      { value: '1m', label: '1 tháng' },
                      { value: '3m', label: '3 tháng' },
                      { value: '6m', label: '6 tháng' }
                    ].map(option => (
                      <label key={option.value} className="radio-label">
                        <input
                          type="radio"
                          name="targetDuration"
                          value={option.value}
                          checked={formData.targetDuration === option.value}
                          onChange={handleInputChange}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 4:
        return (
          <div className="onboarding-step">
            <h2 className="step-title">Sức khỏe</h2>
            <div className="form-group">
              <label>Tình trạng sức khỏe (chọn nhiều nếu có)</label>
              <div className="checkbox-group">
                {[
                  { value: 'normal', label: 'Bình thường' },
                  { value: 'stomach', label: 'Dạ dày/tiêu hóa nhạy cảm' },
                  { value: 'diabetes', label: 'Tiểu đường/tiền tiểu đường' },
                  { value: 'blood_pressure', label: 'Huyết áp' },
                  { value: 'gout', label: 'Gout/axit uric' },
                  { value: 'cholesterol', label: 'Mỡ máu' },
                  { value: 'pregnancy', label: 'Thai kỳ/cho con bú' }
                ].map(option => (
                  <label key={option.value} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.healthConditions.includes(option.value)}
                      onChange={() => handleMultiSelect('healthConditions', option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                name="healthConditionsOther"
                value={formData.healthConditionsOther}
                onChange={handleInputChange}
                placeholder="Khác (ghi chi tiết)"
                className="mt-2"
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="onboarding-step">
            <h2 className="step-title">Chế độ ăn</h2>
            <div className="form-group">
              <label>Chế độ ăn của bạn *</label>
              <div className="radio-group">
                {[
                  { value: 'vegan', label: 'Thuần chay (Vegan)' },
                  { value: 'ovo', label: 'Chay có trứng (Ovo)' },
                  { value: 'lacto', label: 'Chay có sữa (Lacto)' },
                  { value: 'lacto-ovo', label: 'Chay có sữa + trứng (Lacto-ovo)' }
                ].map(option => (
                  <label key={option.value} className="radio-label">
                    <input
                      type="radio"
                      name="dietType"
                      value={option.value}
                      checked={formData.dietType === option.value}
                      onChange={handleInputChange}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                name="dietTypeOther"
                value={formData.dietTypeOther}
                onChange={handleInputChange}
                placeholder="Khác (ghi chi tiết)"
                className="mt-2"
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="onboarding-step">
            <h2 className="step-title">Hạn chế / Dị ứng</h2>
            <div className="form-group">
              <label>Bạn có Dị ứng / Hạn chế không? (chọn nhiều nếu có)</label>
              <div className="checkbox-group">
                {[
                  { value: 'peanut', label: 'Đậu phộng' },
                  { value: 'soy', label: 'Đậu nành' },
                  { value: 'gluten', label: 'Gluten' },
                  { value: 'dairy', label: 'Sữa' },
                  { value: 'egg', label: 'Trứng' },
                  { value: 'sesame', label: 'Mè' },
                  { value: 'tree_nuts', label: 'Hạt cây (hạt điều/hạnh nhân...)' }
                ].map(option => (
                  <label key={option.value} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.allergies.includes(option.value)}
                      onChange={() => handleMultiSelect('allergies', option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                name="allergiesOther"
                value={formData.allergiesOther}
                onChange={handleInputChange}
                placeholder="Khác (ghi chi tiết)"
                className="mt-2"
              />
            </div>
            <div className="form-group">
              <label>Món ăn bạn không thích</label>
              <textarea
                name="dislikes"
                value={formData.dislikes}
                onChange={handleInputChange}
                placeholder="Ví dụ: đậu phụ, nấm, bí ngòi..."
                rows="3"
              />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="onboarding-step">
            <h2 className="step-title">Mức độ hoạt động</h2>
            <div className="form-group">
              <label>Mức độ vận động của bạn *</label>
              <div className="radio-group">
                {[
                  { value: 'sedentary', label: 'Ít vận động' },
                  { value: 'light', label: 'Nhẹ (1-3 buổi/tuần)' },
                  { value: 'moderate', label: 'Vừa (3-5 buổi/tuần)' },
                  { value: 'active', label: 'Nặng (6-7 buổi/tuần)' },
                  { value: 'very_active', label: 'Vận động nhiều/lao động nặng' }
                ].map(option => (
                  <label key={option.value} className="radio-label">
                    <input
                      type="radio"
                      name="activityLevel"
                      value={option.value}
                      checked={formData.activityLevel === option.value}
                      onChange={handleInputChange}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 8: {
        const targets = calculateNutritionTargets(formData);
        const bmi = (parseFloat(formData.weight) / Math.pow(parseFloat(formData.height) / 100, 2)).toFixed(1);
        const goalLabels = { Maintain: 'Duy trì', Lose: 'Giảm cân', Gain: 'Tăng cân' };
        const actLabels = {
          sedentary: 'Ít vận động', light: 'Nhẹ nhàng', moderate: 'Vừa phải',
          active: 'Tích cực', very_active: 'Rất tích cực',
        };
        const nutrients = [
          { label: 'Calories', value: targets.calories, unit: 'kcal', color: '#10b981', icon: '🔥' },
          { label: 'Protein', value: targets.protein, unit: 'g', color: '#3b82f6', icon: '💪' },
          { label: 'Chất béo', value: targets.fat, unit: 'g', color: '#f59e0b', icon: '🥑' },
          { label: 'Carbs', value: targets.carbs, unit: 'g', color: '#8b5cf6', icon: '🌾' },
          { label: 'Chất xơ', value: targets.fiber, unit: 'g', color: '#84cc16', icon: '🥦' },
        ];
        return (
          <div className="onboarding-step">
            <h2 className="step-title">Nhu cầu dinh dưỡng hàng ngày</h2>
            <p className="nutrition-subtitle">
              {formData.height}cm · {formData.weight}kg · BMI {bmi} · {goalLabels[formData.goal] || formData.goal} · {actLabels[formData.activityLevel] || formData.activityLevel}
            </p>
            <div className="nutrition-targets-grid">
              {nutrients.map(n => (
                <div key={n.label} className="nutrition-target-card" style={{ borderTopColor: n.color }}>
                  <span className="nutrition-target-icon">{n.icon}</span>
                  <span className="nutrition-target-value" style={{ color: n.color }}>{n.value}</span>
                  <span className="nutrition-target-unit">{n.unit}</span>
                  <span className="nutrition-target-label">{n.label}</span>
                </div>
              ))}
            </div>
            <div className="nutrition-note">
              💡 Mục tiêu cá nhân hoá theo chỉ số cơ thể và mức độ vận động. GreenPath sẽ thiết kế thực đơn đạt đúng các chỉ số này, giúp bạn {formData.goal === 'Lose' ? 'giảm cân' : formData.goal === 'Gain' ? 'tăng cân' : 'duy trì cân nặng'} một cách khoa học.
            </div>
          </div>
        );
      }

      case 9:
        const getGenderLabel = (value) => {
          const labels = {
            'Male': 'Nam',
            'Female': 'Nữ',
            'Other': 'Khác',
            'Prefer not to say': 'Không muốn tiết lộ'
          };
          return labels[value] || value;
        };

        const getGoalLabel = (value) => {
          const labels = {
            'Maintain': 'Duy trì',
            'Lose': 'Giảm cân',
            'Gain': 'Tăng cân'
          };
          return labels[value] || value;
        };

        const getDietTypeLabel = (value) => {
          const labels = {
            'vegan': 'Thuần chay (Vegan)',
            'ovo': 'Chay có trứng (Ovo)',
            'lacto': 'Chay có sữa (Lacto)',
            'lacto-ovo': 'Chay có sữa + trứng (Lacto-ovo)'
          };
          return labels[value] || value;
        };

        const getActivityLabel = (value) => {
          const labels = {
            'sedentary': 'Ít vận động (sedentary)',
            'light': 'Nhẹ (1-3 buổi/tuần)',
            'moderate': 'Vừa (3-5 buổi/tuần)',
            'active': 'Nặng (6-7 buổi/tuần)',
            'very_active': 'Vận động nhiều/lao động nặng'
          };
          return labels[value] || value;
        };

        const getDurationLabel = (value) => {
          const labels = {
            '1m': '1 tháng',
            '3m': '3 tháng',
            '6m': '6 tháng'
          };
          return labels[value] || value;
        };

        return (
          <div className="onboarding-step summary-step">
            <h2 className="step-title">Xác nhận thông tin</h2>
            <div className="summary-content">
              <div className="summary-section">
                <h3>Thông tin cơ bản</h3>
                <p><strong>Tên:</strong> {formData.name}</p>
                <p><strong>Tuổi:</strong> {formData.age}</p>
                <p><strong>Giới tính:</strong> {getGenderLabel(formData.gender)}</p>
              </div>
              
              <div className="summary-section">
                <h3>Cơ thể</h3>
                <p><strong>Chiều cao:</strong> {formData.height} cm</p>
                <p><strong>Cân nặng:</strong> {formData.weight} kg</p>
                <p><strong>BMI:</strong> {(formData.weight / Math.pow(formData.height / 100, 2)).toFixed(1)}</p>
              </div>
              
              <div className="summary-section">
                <h3>Mục tiêu</h3>
                <p><strong>Mục tiêu:</strong> {getGoalLabel(formData.goal)}</p>
                {formData.targetWeight && <p><strong>Số kg:</strong> {formData.targetWeight} kg</p>}
                {formData.targetDuration && <p><strong>Thời gian:</strong> {getDurationLabel(formData.targetDuration)}</p>}
              </div>
              
              <div className="summary-section">
                <h3>Chế độ ăn & Sức khỏe</h3>
                <p><strong>Chế độ ăn:</strong> {getDietTypeLabel(formData.dietType)}</p>
                <p><strong>Mức độ vận động:</strong> {getActivityLabel(formData.activityLevel)}</p>
              </div>
            </div>
            <p className="edit-note">Bạn có thể chỉnh sửa thông tin này sau trong phần cài đặt</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-container">
      <button className="onboarding-logout-btn" onClick={handleLogout}>
        Đăng xuất
      </button>
      <div className="onboarding-content">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(currentStep / 9) * 100}%` }}></div>
        </div>
        
        <div className="step-indicator">
          Bước {currentStep}/9
        </div>

        {renderStep()}

        <div className="button-group">
          {currentStep > 1 && (
            <button className="btn-secondary" onClick={handleBack}>
              ← Quay lại
            </button>
          )}
          
          {currentStep < 9 ? (
            <button className="btn-primary" onClick={handleNext}>
              Tiếp tục →
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSubmit}>
              Xác nhận
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
