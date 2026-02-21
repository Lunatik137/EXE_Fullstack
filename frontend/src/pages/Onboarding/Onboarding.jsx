import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Onboarding.css';

const Onboarding = () => {
  const { url, token, setHasCompletedOnboarding } = useContext(StoreContext);
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
        if (formData.age < 10 || formData.age > 90) {
          toast.error('Tuổi phải từ 10 đến 90!');
          return false;
        }
        return true;
      case 2:
        if (!formData.height || !formData.weight) {
          toast.error('Vui lòng điền đầy đủ thông tin!');
          return false;
        }
        if (formData.height < 100 || formData.height > 230) {
          toast.error('Chiều cao phải từ 100 đến 230 cm!');
          return false;
        }
        if (formData.weight < 25 || formData.weight > 250) {
          toast.error('Cân nặng phải từ 25 đến 250 kg!');
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
      if (currentStep < 8) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    try {
      const response = await axios.post(
        `${url}/api/user/onboarding`,
        formData,
        { headers: { token } }
      );

      if (response.data.success) {
        // Update onboarding status in localStorage and context
        localStorage.setItem('hasCompletedOnboarding', 'true');
        setHasCompletedOnboarding(true);
        
        toast.success('Hoàn thành! Bây giờ hãy chọn gói lộ trình của bạn.');
        navigate('/plan-selection');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Đã có lỗi xảy ra. Vui lòng thử lại!');
    }
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
              <label>Tuổi * (10-90)</label>
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
              <label>Chiều cao (cm) * (100-230)</label>
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
              <label>Cân nặng (kg) * (25-250)</label>
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
                  <label>Bạn muốn {formData.goal === 'Lose' ? 'giảm' : 'tăng'} bao nhiêu kg? * (1-50)</label>
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
            <p className="disclaimer">⚠️ Thông tin này không thay thế tư vấn y tế chuyên nghiệp</p>
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
              <label>Dị ứng / Hạn chế (chọn nhiều nếu có)</label>
              <div className="checkbox-group">
                {[
                  { value: 'peanut', label: 'Đậu phộng' },
                  { value: 'soy', label: 'Đậu nành' },
                  { value: 'gluten', label: 'Gluten' },
                  { value: 'dairy', label: 'Sữa' },
                  { value: 'egg', label: 'Trứng' },
                  { value: 'seafood', label: 'Hải sản' },
                  { value: 'sesame', label: 'Mè (sesame)' },
                  { value: 'tree_nuts', label: 'Tree nuts (hạt điều/hạnh nhân...)' }
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
                  { value: 'sedentary', label: 'Ít vận động (sedentary)' },
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

      case 8:
        return (
          <div className="onboarding-step summary-step">
            <h2 className="step-title">Xác nhận thông tin</h2>
            <div className="summary-content">
              <div className="summary-section">
                <h3>Thông tin cơ bản</h3>
                <p><strong>Tên:</strong> {formData.name}</p>
                <p><strong>Tuổi:</strong> {formData.age}</p>
                <p><strong>Giới tính:</strong> {formData.gender}</p>
              </div>
              
              <div className="summary-section">
                <h3>Cơ thể</h3>
                <p><strong>Chiều cao:</strong> {formData.height} cm</p>
                <p><strong>Cân nặng:</strong> {formData.weight} kg</p>
                <p><strong>BMI:</strong> {(formData.weight / Math.pow(formData.height / 100, 2)).toFixed(1)}</p>
              </div>
              
              <div className="summary-section">
                <h3>Mục tiêu</h3>
                <p><strong>Mục tiêu:</strong> {formData.goal === 'Maintain' ? 'Duy trì' : formData.goal === 'Lose' ? 'Giảm cân' : 'Tăng cân'}</p>
                {formData.targetWeight && <p><strong>Số kg:</strong> {formData.targetWeight} kg</p>}
                {formData.targetDuration && <p><strong>Thời gian:</strong> {formData.targetDuration}</p>}
              </div>
              
              <div className="summary-section">
                <h3>Chế độ ăn & Sức khỏe</h3>
                <p><strong>Chế độ ăn:</strong> {formData.dietType}</p>
                <p><strong>Mức độ vận động:</strong> {formData.activityLevel}</p>
              </div>
              
              <p className="edit-note">💡 Bạn có thể chỉnh sửa thông tin này sau trong phần cài đặt</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(currentStep / 8) * 100}%` }}></div>
        </div>
        
        <div className="step-indicator">
          Bước {currentStep}/8
        </div>

        {renderStep()}

        <div className="button-group">
          {currentStep > 1 && (
            <button className="btn-secondary" onClick={handleBack}>
              ← Quay lại
            </button>
          )}
          
          {currentStep < 8 ? (
            <button className="btn-primary" onClick={handleNext}>
              Tiếp tục →
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSubmit}>
              🚀 Tạo lộ trình
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
