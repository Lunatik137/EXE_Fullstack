import { useState, useEffect, useContext } from 'react';
import './Profile.css';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { toast } from 'react-toastify';

// Helper functions for Vietnamese translations
const getGenderLabel = (gender) => {
  if (gender === 'Male') return 'Nam';
  if (gender === 'Female') return 'Nữ';
  if (gender === 'Other') return 'Khác';
  if (gender === 'Prefer not to say') return 'Không muốn tiết lộ';
  return 'N/A';
};

const getGoalLabel = (goal) => {
  if (goal === 'Lose') return 'Giảm cân';
  if (goal === 'Gain') return 'Tăng cân';
  if (goal === 'Maintain') return 'Duy trì';
  return 'N/A';
};

const getDietTypeLabel = (dietType) => {
  const mapping = {
    'vegan': 'Thuần chay (Vegan)',
    'ovo': 'Chay có trứng (Ovo)',
    'lacto': 'Chay có sữa (Lacto)',
    'lacto-ovo': 'Chay có sữa + trứng (Lacto-ovo)'
  };
  return mapping[dietType] || dietType || 'N/A';
};

const getHealthConditionsLabel = (conditions) => {
  if (!conditions || conditions.length === 0) return 'Không có';
  
  if (Array.isArray(conditions)) {
    const mapping = {
      'normal': 'Bình thường',
      'stomach': 'Dạ dày/tiêu hóa nhạy cảm',
      'diabetes': 'Tiểu đường/tiền tiểu đường',
      'blood_pressure': 'Huyết áp',
      'gout': 'Gout/axit uric',
      'cholesterol': 'Mỡ máu',
      'pregnancy': 'Thai kỳ/cho con bú'
    };
    return conditions.map(c => mapping[c] || c).join(', ');
  }
  
  if (conditions === 'normal') return 'Bình thường';
  return conditions;
};

const getAllergiesLabel = (allergies) => {
  if (!allergies || allergies.length === 0) return 'Không có';
  
  if (Array.isArray(allergies)) {
    const mapping = {
      'peanut': 'Đậu phộng',
      'soy': 'Đậu nành',
      'gluten': 'Gluten',
      'dairy': 'Sữa',
      'egg': 'Trứng',
      'seafood': 'Hải sản',
      'sesame': 'Mè (sesame)',
      'tree_nuts': 'Tree nuts (hạt điều/hạnh nhân...)'
    };
    return allergies.map(a => mapping[a] || a).join(', ');
  }
  
  return allergies;
};

const getTargetDurationLabel = (duration) => {
  if (!duration) return 'N/A';
  if (duration.endsWith('m')) {
    const months = duration.replace('m', '');
    return `${months} tháng`;
  }
  if (duration.endsWith('y')) {
    const years = duration.replace('y', '');
    return `${years} năm`;
  }
  return duration;
};

const getActivityLevelLabel = (level) => {
  const mapping = {
    'sedentary': 'Ít vận động',
    'light': 'Nhẹ',
    'moderate': 'Vừa phải',
    'active': 'Nặng',
    'very_active': 'Vận động nhiều/lao động nặng'
  };
  return mapping[level] || level || 'N/A';
};

const Profile = () => {
  const { url, token } = useContext(StoreContext);
  const [isEditing, setIsEditing] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [newWeight, setNewWeight] = useState('');
  const [editedProfile, setEditedProfile] = useState({
    name: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    targetWeight: '',
    targetDuration: '',
    goal: '',
    activityLevel: '',
    dietType: '',
    dietTypeOther: '',
    healthConditions: [],
    healthConditionsOther: '',
    allergies: [],
    allergiesOther: '',
    dislikes: ''
  });

  useEffect(() => {
    if (token) {
      fetchUserProfile();
      fetchWeightHistory();
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.post(`${url}/api/user/profile`, {}, {
        headers: { token }
      });
      if (response.data.success) {
        setUser(response.data.user);
        setEditedProfile({
          name: response.data.user.name,
          age: response.data.user.onboardingData?.age || '',
          gender: response.data.user.onboardingData?.gender || '',
          height: response.data.user.onboardingData?.height || '',
          weight: response.data.user.onboardingData?.weight || '',
          targetWeight: response.data.user.onboardingData?.targetWeight || '',
          targetDuration: response.data.user.onboardingData?.targetDuration || '',
          goal: response.data.user.onboardingData?.goal || '',
          activityLevel: response.data.user.onboardingData?.activityLevel || '',
          dietType: response.data.user.onboardingData?.dietType || '',
          dietTypeOther: response.data.user.onboardingData?.dietTypeOther || '',
          healthConditions: response.data.user.onboardingData?.healthConditions || [],
          healthConditionsOther: response.data.user.onboardingData?.healthConditionsOther || '',
          allergies: response.data.user.onboardingData?.allergies || [],
          allergiesOther: response.data.user.onboardingData?.allergiesOther || '',
          dislikes: response.data.user.onboardingData?.dislikes || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeightHistory = async () => {
    try {
      const response = await axios.post(`${url}/api/weight/history`, {}, {
        headers: { token }
      });
      if (response.data.success) {
        setWeightHistory(response.data.weights);
      }
    } catch (error) {
      console.error('Error fetching weight history:', error);
    }
  };

  const toggleMultiSelect = (field, value) => {
    setEditedProfile((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      return {
        ...prev,
        [field]: exists ? current.filter((item) => item !== value) : [...current, value]
      };
    });
  };

  const handleSaveProfile = async () => {
    try {
      const response = await axios.post(`${url}/api/user/update-profile`, {
        name: editedProfile.name,
        onboardingData: {
          ...user.onboardingData,
          age: editedProfile.age,
          gender: editedProfile.gender,
          height: editedProfile.height,
          weight: editedProfile.weight,
          targetWeight: editedProfile.targetWeight,
          targetDuration: editedProfile.targetDuration,
          goal: editedProfile.goal,
          activityLevel: editedProfile.activityLevel,
          dietType: editedProfile.dietType,
          dietTypeOther: editedProfile.dietTypeOther,
          healthConditions: editedProfile.healthConditions,
          healthConditionsOther: editedProfile.healthConditionsOther,
          allergies: editedProfile.allergies,
          allergiesOther: editedProfile.allergiesOther,
          dislikes: editedProfile.dislikes
        }
      }, {
        headers: { token }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
        setIsEditing(false);
        toast.success('Cập nhật thành công!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Có lỗi xảy ra khi cập nhật!');
    }
  };

  const handleAddWeight = async () => {
    if (!newWeight || newWeight <= 0) {
      toast.error('Vui lòng nhập cân nặng hợp lệ!');
      return;
    }

    try {
      const response = await axios.post(`${url}/api/weight/add`, {
        weight: parseFloat(newWeight),
        date: new Date()
      }, {
        headers: { token }
      });
      
      if (response.data.success) {
        setNewWeight('');
        setShowWeightModal(false);
        fetchUserProfile();
        fetchWeightHistory();
        toast.success('Đã cập nhật cân nặng!');
      }
    } catch (error) {
      console.error('Error adding weight:', error);
      toast.error('Có lỗi xảy ra!');
    }
  };

  // Calculate TDEE
  const calculateTDEE = () => {
    if (!user?.onboardingData) return 0;
    
    const { weight, height, age, gender, activityLevel } = user.onboardingData;
    
    // Mifflin-St Jeor equation
    let bmr;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }
    
    // Activity multipliers
    const activityMultipliers = {
      'sedentary': 1.2,
      'light': 1.375,
      'moderate': 1.55,
      'active': 1.725,
      'very_active': 1.9
    };
    
    const multiplier = activityMultipliers[activityLevel] || 1.2;
    return Math.round(bmr * multiplier);
  };

  // Calculate target weight change per week
  const calculateWeightChange = () => {
    if (!user?.onboardingData) return 0;
    
    const { goal } = user.onboardingData;
    const goalLower = goal?.toLowerCase();
    
    if (goalLower === 'lose') return -0.5;
    if (goalLower === 'gain') return 0.5;
    return 0;
  };

  // Get goal label based on user's goal
  const getGoalLabel = () => {
    if (!user?.onboardingData?.goal) return 'Mục tiêu';
    const { goal } = user.onboardingData;
    const goalLower = goal?.toLowerCase();
    if (goalLower === 'lose') return 'Giảm cân';
    if (goalLower === 'gain') return 'Tăng cân';
    return 'Duy trì';
  };

  // Calculate calorie goal
  const calculateCalorieGoal = () => {
    const tdee = calculateTDEE();
    const weightChange = calculateWeightChange();
    
    // 1kg = ~7700 calories, per week = ~1100 cal/day
    const adjustment = weightChange * 1100;
    
    return Math.round(tdee + adjustment);
  };

  // Get weight progress
  const getWeightProgress = () => {
    if (weightHistory.length === 0) return [];
    
    return weightHistory
      .slice(0, 10)
      .reverse()
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        weight: entry.weight
      }));
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="error">Không thể tải thông tin người dùng</div>
      </div>
    );
  }

  const currentWeight = user.onboardingData?.weight || 0;
  const targetWeight = user.onboardingData?.targetWeight || 0;
  const tdee = calculateTDEE();
  const weightChange = calculateWeightChange();
  const calorieGoal = calculateCalorieGoal();
  const weightProgress = getWeightProgress();

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Header Section */}
        <div className="profile-header-card">
          {!isEditing ? (
            <>
              <div className="profile-avatar-section">
                <div className="profile-avatar">
                  <img 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10b981&color=fff&size=100`} 
                    alt="Avatar" 
                  />
                </div>
                <div className="profile-info">
                  <h2>{user.name}</h2>
                </div>
              </div>
              
              {/* User Info Grid - 2 columns */}
              <div className="user-info-grid">
                <div className="info-item">
                  <span className="info-label">Tuổi:</span>
                  <span className="info-value">{user.onboardingData?.age || 'N/A'} tuổi</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Giới tính:</span>
                  <span className="info-value">{getGenderLabel(user.onboardingData?.gender)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Chiều cao:</span>
                  <span className="info-value">{user.onboardingData?.height || 'N/A'} cm</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Cân nặng hiện tại:</span>
                  <span className="info-value">{user.onboardingData?.weight || 'N/A'} kg</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Cân nặng mục tiêu:</span>
                  <span className="info-value">{user.onboardingData?.targetWeight || 'N/A'} kg</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Thời gian mục tiêu:</span>
                  <span className="info-value">{getTargetDurationLabel(user.onboardingData?.targetDuration)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Mục tiêu:</span>
                  <span className="info-value">{getGoalLabel(user.onboardingData?.goal)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Mức độ hoạt động:</span>
                  <span className="info-value">{getActivityLevelLabel(user.onboardingData?.activityLevel)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Chế độ ăn:</span>
                  <span className="info-value">{getDietTypeLabel(user.onboardingData?.dietType || user.onboardingData?.dietTypeOther)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Tình trạng sức khỏe:</span>
                  <span className="info-value">
                    {getHealthConditionsLabel(user.onboardingData?.healthConditions)}
                    {user.onboardingData?.healthConditionsOther && `, ${user.onboardingData.healthConditionsOther}`}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Dị ứng:</span>
                  <span className="info-value">
                    {getAllergiesLabel(user.onboardingData?.allergies)}
                    {user.onboardingData?.allergiesOther && `, ${user.onboardingData.allergiesOther}`}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Món không thích:</span>
                  <span className="info-value">{user.onboardingData?.dislikes || 'Không có'}</span>
                </div>
              </div>

              <button className="settings-btn" onClick={() => setIsEditing(true)}>
                Chỉnh sửa
              </button>
            </>
          ) : (
            <div className="edit-profile-form">
              <h3>Chỉnh sửa thông tin</h3>
              
              <div className="form-group">
                <label>Họ và tên</label>
                <input 
                  type="text" 
                  value={editedProfile.name}
                  onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Tuổi</label>
                <input 
                  type="number" 
                  value={editedProfile.age}
                  onChange={(e) => setEditedProfile({...editedProfile, age: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Giới tính</label>
                <div className="radio-group">
                  {[
                    { value: 'Male', label: 'Nam' },
                    { value: 'Female', label: 'Nữ' },
                    { value: 'Other', label: 'Khác' },
                    { value: 'Prefer not to say', label: 'Không muốn tiết lộ' }
                  ].map(option => (
                    <label key={option.value} className="radio-label">
                      <input
                        type="radio"
                        name="gender"
                        value={option.value}
                        checked={editedProfile.gender === option.value}
                        onChange={(e) => setEditedProfile({...editedProfile, gender: e.target.value})}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Chiều cao (cm)</label>
                <input 
                  type="number" 
                  value={editedProfile.height}
                  onChange={(e) => setEditedProfile({...editedProfile, height: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Cân nặng hiện tại (kg)</label>
                <input 
                  type="number" 
                  value={editedProfile.weight}
                  onChange={(e) => setEditedProfile({...editedProfile, weight: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Mục tiêu</label>
                <select 
                  value={editedProfile.goal}
                  onChange={(e) => setEditedProfile({...editedProfile, goal: e.target.value})}
                >
                  <option value="Maintain">Duy trì</option>
                  <option value="Lose">Giảm cân</option>
                  <option value="Gain">Tăng cân</option>
                </select>
              </div>

              <div className="form-group">
                <label>Cân nặng mục tiêu (kg)</label>
                <input 
                  type="number" 
                  value={editedProfile.targetWeight}
                  onChange={(e) => setEditedProfile({...editedProfile, targetWeight: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Thời gian mục tiêu</label>
                <select 
                  value={editedProfile.targetDuration}
                  onChange={(e) => setEditedProfile({...editedProfile, targetDuration: e.target.value})}
                >
                  <option value="">Chọn thời gian</option>
                  <option value="1m">1 tháng</option>
                  <option value="3m">3 tháng</option>
                  <option value="6m">6 tháng</option>
                </select>
              </div>

              <div className="form-group">
                <label>Mức độ hoạt động</label>
                <select 
                  value={editedProfile.activityLevel}
                  onChange={(e) => setEditedProfile({...editedProfile, activityLevel: e.target.value})}
                >
                  <option value="sedentary">Ít vận động</option>
                  <option value="light">Nhẹ (1-3 ngày/tuần)</option>
                  <option value="moderate">Vừa (3-5 buổi/tuần)</option>
                  <option value="active">Nặng (6-7 buổi/tuần)</option>
                  <option value="very_active">Vận động nhiều/lao động nặng</option>
                </select>
              </div>

              <div className="form-group">
                <label>Chế độ ăn</label>
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
                        checked={editedProfile.dietType === option.value}
                        onChange={(e) => setEditedProfile({...editedProfile, dietType: e.target.value})}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={editedProfile.dietTypeOther}
                  onChange={(e) => setEditedProfile({...editedProfile, dietTypeOther: e.target.value})}
                  placeholder="Khác (ghi chi tiết)"
                  className="mt-2"
                />
              </div>

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
                        checked={editedProfile.healthConditions.includes(option.value)}
                        onChange={() => toggleMultiSelect('healthConditions', option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={editedProfile.healthConditionsOther}
                  onChange={(e) => setEditedProfile({...editedProfile, healthConditionsOther: e.target.value})}
                  placeholder="Khác (ghi chi tiết)"
                  className="mt-2"
                />
              </div>

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
                        checked={editedProfile.allergies.includes(option.value)}
                        onChange={() => toggleMultiSelect('allergies', option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={editedProfile.allergiesOther}
                  onChange={(e) => setEditedProfile({...editedProfile, allergiesOther: e.target.value})}
                  placeholder="Khác (ghi chi tiết)"
                  className="mt-2"
                />
              </div>

              <div className="form-group">
                <label>Món không thích</label>
                <textarea
                  value={editedProfile.dislikes}
                  onChange={(e) => setEditedProfile({...editedProfile, dislikes: e.target.value})}
                />
              </div>

              <div className="edit-actions">
                <button className="save-btn" onClick={handleSaveProfile}>Lưu</button>
                <button className="cancel-btn" onClick={() => setIsEditing(false)}>Hủy</button>
              </div>
            </div>
          )}
        </div>

        {/* Goals Overview */}
        <div className="goals-card">
          <h3>Tổng quan mục tiêu</h3>
          <div className="goals-grid">
            <div className="goal-item">
              <div className="goal-icon">
                <svg width="50" height="50" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
  <path d="M128 32c20 30-10 40 10 70 15-10 40-5 40 35 0 30-22 57-50 57s-50-27-50-57c0-35 25-45 35-65 5 15 20 20 15-10z"/>
  <path d="M128 110c10 15-5 20 5 35 8-6 20-3 20 18 0 15-11 27-25 27s-25-12-25-27c0-18 13-23 20-33"/>
</svg>

              </div>
              <div className="goal-details">
                <p className="goal-label">TDEE</p>
                <p className="goal-value">{tdee}kcal</p>
              </div>
            </div>
            
            <div className="goal-item">
              <div className="goal-icon">
                <svg width="50" height="50" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
  <path d="M48 160a80 80 0 0 1 160 0" />
  <path d="M128 120l35-20" />
  <circle cx="128" cy="120" r="8" fill="currentColor" stroke="none"/>
</svg>

              </div>
              <div className="goal-details">
                <p className="goal-label">{getGoalLabel()}</p>
                <p className="goal-value">{weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg/tuần</p>
              </div>
            </div>
            
            <div className="goal-item">
              <div className="goal-icon">
                <svg width="50" height="50" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
  <path d="M128 32c20 30-10 40 10 70 15-10 40-5 40 35 0 30-22 57-50 57s-50-27-50-57c0-35 25-45 35-65 5 15 20 20 15-10z"/>
  <path d="M140 90l-25 45h25l-20 50 50-70h-30l20-25z" fill="currentColor" stroke="none"/>
</svg>

              </div>
              <div className="goal-details">
                <p className="goal-label">Mục tiêu Calo</p>
                <p className="goal-value">{calorieGoal}kcal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Weight Progress Chart */}
        <div className="weight-chart-card">
          <div className="chart-header">
            <h3>Thay đổi cân nặng</h3>
            <button className="add-weight-btn" onClick={() => setShowWeightModal(true)}>
              + Cập nhật cân nặng
            </button>
          </div>
          
          {weightProgress.length > 0 ? (
            <div className="weight-chart">
              <div className="chart-area">
                <svg className="chart-lines" width="100%" height="100%">
                  {weightProgress.length > 1 && weightProgress.map((point, index) => {
                    if (index === weightProgress.length - 1) return null;
                    const maxWeight = Math.max(...weightProgress.map(p => p.weight));
                    const minWeight = Math.min(...weightProgress.map(p => p.weight));
                    const range = maxWeight - minWeight || 1;
                    const nextPoint = weightProgress[index + 1];
                    const x1 = (index / (weightProgress.length - 1)) * 100;
                    const y1 = 100 - (((point.weight - minWeight) / range) * 80 + 10);
                    const x2 = ((index + 1) / (weightProgress.length - 1)) * 100;
                    const y2 = 100 - (((nextPoint.weight - minWeight) / range) * 80 + 10);
                    return (
                      <line
                        key={index}
                        x1={`${x1}%`}
                        y1={`${y1}%`}
                        x2={`${x2}%`}
                        y2={`${y2}%`}
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>
                {weightProgress.map((point, index) => {
                  const maxWeight = Math.max(...weightProgress.map(p => p.weight));
                  const minWeight = Math.min(...weightProgress.map(p => p.weight));
                  const range = maxWeight - minWeight || 1;
                  const isSinglePoint = weightProgress.length === 1;
                  const bottom = isSinglePoint ? 50 : ((point.weight - minWeight) / range) * 80 + 10;
                  const left = isSinglePoint ? 0 : (index / (weightProgress.length - 1)) * 100;
                  
                  return (
                    <div 
                      key={index} 
                      className="chart-point"
                      style={{
                        left: `${left}%`,
                        bottom: `${bottom}%`,
                        transform: isSinglePoint ? 'translate(0, 50%)' : 'translate(-50%, 50%)'
                      }}
                    >
                      <div className="point-dot"></div>
                      <div className="point-label">{point.weight} kg</div>
                    </div>
                  );
                })}
              </div>
              <div className="chart-x-axis">
                {weightProgress.map((point, index) => (
                  <div key={index} className="x-label">{point.date}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-data">Chưa có dữ liệu cân nặng</div>
          )}
        </div>

        {/* Weight Modal */}
        {showWeightModal && (
          <div className="modal-overlay" onClick={() => setShowWeightModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Cập nhật cân nặng</h3>
              <div className="form-group">
                <label>Cân nặng hiện tại (kg)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="Ví dụ: 65.5"
                />
              </div>
              <div className="modal-actions">
                <button className="save-btn" onClick={handleAddWeight}>Lưu</button>
                <button className="cancel-btn" onClick={() => setShowWeightModal(false)}>Hủy</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
