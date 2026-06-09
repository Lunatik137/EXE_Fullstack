import { useState, useEffect, useContext, useCallback } from 'react';
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

const calculateBackendAlignedNutritionTargets = (onboardingData) => {
  if (!onboardingData) {
    return { tdee: 0, calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  }

  const weight = parseFloat(onboardingData.weight) || 70;
  const height = parseFloat(onboardingData.height) || 170;
  const age = parseFloat(onboardingData.age) || 25;
  const gender = String(onboardingData.gender || '').trim().toLowerCase();
  const goal = String(onboardingData.goal || '').trim().toLowerCase();

  // Mifflin-St Jeor — matches backend formula
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === 'female') {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 78; // average
  }

  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };

  const tdee = Math.round(bmr * (multipliers[onboardingData.activityLevel] || 1.375));
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

  if (goal === 'lose') {
    if (onboardingData.targetWeight && onboardingData.targetDuration) {
      const weeks = parseDurationToWeeks(onboardingData.targetDuration);
      const dailyDeficit = Math.round((parseFloat(onboardingData.targetWeight) / weeks * 7700) / 7);
      calories = Math.max(1200, tdee - dailyDeficit);
    } else {
      calories = Math.max(1200, tdee - 500);
    }
  } else if (goal === 'gain') {
    if (onboardingData.targetWeight && onboardingData.targetDuration) {
      const weeks = parseDurationToWeeks(onboardingData.targetDuration);
      const dailySurplus = Math.round((parseFloat(onboardingData.targetWeight) / weeks * 7700) / 7);
      calories = tdee + dailySurplus;
    } else {
      calories = tdee + 300;
    }
  }

  const proteinFactor = goal === 'maintain' ? 1.4 : (goal === 'lose' ? 1.8 : 1.6);
  const protein = Math.round(weight * proteinFactor);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.round(Math.max(calories - protein * 4 - fat * 9, 0) / 4);
  const fiber = Math.max(25, Math.round((calories / 1000) * 14));

  return { tdee, calories, protein, fat, carbs, fiber };
};

const mapUserToEditedProfile = (profileUser) => ({
  name: profileUser?.name || '',
  age: profileUser?.onboardingData?.age || '',
  gender: profileUser?.onboardingData?.gender || '',
  height: profileUser?.onboardingData?.height || '',
  weight: profileUser?.onboardingData?.weight || '',
  targetWeight: profileUser?.onboardingData?.targetWeight || '',
  targetDuration: profileUser?.onboardingData?.targetDuration || '',
  goal: profileUser?.onboardingData?.goal || '',
  activityLevel: profileUser?.onboardingData?.activityLevel || '',
  dietType: profileUser?.onboardingData?.dietType || '',
  healthConditions: profileUser?.onboardingData?.healthConditions || [],
  healthConditionsOther: profileUser?.onboardingData?.healthConditionsOther || '',
  allergies: profileUser?.onboardingData?.allergies || [],
  allergiesOther: profileUser?.onboardingData?.allergiesOther || '',
  dislikes: profileUser?.onboardingData?.dislikes || ''
});

const sanitizeProfileData = (data) => {
  const nextData = { ...data };
  if (nextData.goal !== 'Lose' && nextData.goal !== 'Gain') {
    nextData.targetWeight = '';
    nextData.targetDuration = '';
  }
  return nextData;
};

const Profile = () => {
  const { url, token, setNutritionTargets, darkMode, toggleDarkMode } = useContext(StoreContext);
  const [isEditing, setIsEditing] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileWarnings, setProfileWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [newWeight, setNewWeight] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [mealReminderSettings, setMealReminderSettings] = useState({
    enabled: false,
    breakfastTime: '',
    lunchTime: '',
    dinnerTime: ''
  });
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
    healthConditions: [],
    healthConditionsOther: '',
    allergies: [],
    allergiesOther: '',
    dislikes: ''
  });

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await axios.post(`${url}/api/user/profile`, {}, {
        headers: { token }
      });
      if (response.data.success) {
        setUser(response.data.user);
        setEditedProfile(mapUserToEditedProfile(response.data.user));
        setMealReminderSettings({
          enabled:
            response.data.user.planType === 'premium' &&
            response.data.user.subscriptionStatus === 'active' &&
            response.data.user.subscriptionEndDate &&
            new Date(response.data.user.subscriptionEndDate) > new Date()
              ? response.data.user.mealReminderSettings?.enabled || false
              : false,
          breakfastTime: response.data.user.mealReminderSettings?.breakfastTime || '',
          lunchTime: response.data.user.mealReminderSettings?.lunchTime || '',
          dinnerTime: response.data.user.mealReminderSettings?.dinnerTime || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [token, url]);

  const fetchWeightHistory = useCallback(async () => {
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
  }, [token, url]);

  useEffect(() => {
    if (token) {
      fetchUserProfile();
      fetchWeightHistory();
    }
  }, [token, fetchUserProfile, fetchWeightHistory]);

  useEffect(() => {
    if (!isEditing) return;
    if (profileWarnings.length > 0) {
      setProfileWarnings([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedProfile]);

  const toggleMultiSelect = (field, value) => {
    if (profileWarnings.length > 0) {
      setProfileWarnings([]);
    }
    setEditedProfile((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      return {
        ...prev,
        [field]: exists ? current.filter((item) => item !== value) : [...current, value]
      };
    });
  };

  const handleOpenEditModal = () => {
    setEditedProfile(mapUserToEditedProfile(user));
    setAvatarFile(null);
    setProfileWarnings([]);
    setIsEditing(true);
  };

  const handleCloseEditModal = () => {
    setIsEditing(false);
    setProfileWarnings([]);
    setAvatarFile(null);
    setEditedProfile(mapUserToEditedProfile(user));
  };

  const buildOnboardingPayload = () => ({
    ...user.onboardingData,
    ...sanitizeProfileData({
      age: editedProfile.age,
      gender: editedProfile.gender,
      height: editedProfile.height,
      weight: editedProfile.weight,
      targetWeight: editedProfile.targetWeight,
      targetDuration: editedProfile.targetDuration,
      goal: editedProfile.goal,
      activityLevel: editedProfile.activityLevel,
      dietType: editedProfile.dietType,
      healthConditions: editedProfile.healthConditions,
      healthConditionsOther: editedProfile.healthConditionsOther,
      allergies: editedProfile.allergies,
      allergiesOther: editedProfile.allergiesOther,
      dislikes: editedProfile.dislikes
    })
  });

  const buildProfileFormData = ({ aiCheckOnly = false, skipAiAssessment = false } = {}) => {
    const formData = new FormData();
    formData.append('name', editedProfile.name);

    if (avatarFile && !aiCheckOnly) {
      formData.append('avatar', avatarFile);
    }

    formData.append('onboardingData', JSON.stringify(buildOnboardingPayload()));

    if (aiCheckOnly) {
      formData.append('aiCheckOnly', 'true');
    }

    if (skipAiAssessment) {
      formData.append('skipAiAssessment', 'true');
    }

    return formData;
  };

  const handleSaveProfile = async () => {
    if (isSavingProfile) return;

    try {
      setIsSavingProfile(true);

      const checkResponse = await axios.post(`${url}/api/user/update-profile`, buildProfileFormData({ aiCheckOnly: true }), {
        headers: {
          token,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (!checkResponse.data.success) {
        toast.error(checkResponse.data.message || 'Không thể đánh giá dữ liệu hồ sơ');
        return;
      }

      const warnings = checkResponse.data?.onboardingAssessment?.warnings || [];
      if (warnings.length > 0) {
        setProfileWarnings(warnings);
        toast.warn('Hồ sơ có cảnh báo AI. Vui lòng chỉnh lại trước khi lưu.');
        return;
      }

      const response = await axios.post(`${url}/api/user/update-profile`, buildProfileFormData({ skipAiAssessment: true }), {
        headers: {
          token,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
        setNutritionTargets(response.data.user?.nutritionTargets || null);
        handleCloseEditModal();
        toast.success('Cập nhật thành công!');
      } else {
        toast.error(response.data.message || 'Có lỗi xảy ra khi cập nhật!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Có lỗi xảy ra khi cập nhật!');
    } finally {
      setIsSavingProfile(false);
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

  const handleSaveMealReminderSettings = async () => {
    if (!isPremiumActive) {
      toast.error('Tính năng nhắc bữa ăn chỉ dành cho tài khoản Premium còn hạn');
      return;
    }

    if (
      mealReminderSettings.enabled &&
      !mealReminderSettings.breakfastTime &&
      !mealReminderSettings.lunchTime &&
      !mealReminderSettings.dinnerTime
    ) {
      toast.error('Vui lòng chọn ít nhất 1 khung giờ nhắc bữa ăn');
      return;
    }

    try {
      const response = await axios.post(
        `${url}/api/user/update-profile`,
        { mealReminderSettings },
        { headers: { token } }
      );

      if (response.data.success) {
        setUser(response.data.user);
        toast.success('Đã lưu cài đặt nhắc bữa ăn');
      } else {
        toast.error(response.data.message || 'Không thể lưu cài đặt nhắc bữa ăn');
      }
    } catch (error) {
      console.error('Error saving meal reminder settings:', error);
      toast.error('Có lỗi xảy ra khi lưu cài đặt nhắc bữa ăn');
    }
  };

  // Calculate target weight change per week from actual targetWeight/targetDuration
  const calculateWeightChange = () => {
    if (!user?.onboardingData) return 0;

    const { goal, targetWeight, targetDuration } = user.onboardingData;
    const goalLower = goal?.toLowerCase();
    if (goalLower !== 'lose' && goalLower !== 'gain') return 0;

    if (targetWeight && targetDuration) {
      const parseDurationToWeeks = (d) => {
        if (!d) return 12;
        const val = parseFloat(d);
        if (isNaN(val) || val <= 0) return 12;
        if (d.endsWith('y')) return val * 52;
        if (d.endsWith('m')) return val * 4.33;
        if (d.endsWith('w')) return val;
        return 12;
      };
      const weeks = parseDurationToWeeks(targetDuration);
      const rate = parseFloat(targetWeight) / weeks;
      return goalLower === 'lose' ? -Math.round(rate * 100) / 100 : Math.round(rate * 100) / 100;
    }

    // Fallback to default rate if no target set
    return goalLower === 'lose' ? -0.5 : 0.5;
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

  const persistedNutritionTargets = user?.nutritionTargets || {};
  const fallbackNutritionTargets = calculateBackendAlignedNutritionTargets(user?.onboardingData);
  const effectiveNutritionTargets = {
    ...fallbackNutritionTargets,
    ...persistedNutritionTargets
  };

  const tdee = effectiveNutritionTargets.tdee || fallbackNutritionTargets.tdee;
  const weightChange = calculateWeightChange();
  const calorieGoal = effectiveNutritionTargets.calories || fallbackNutritionTargets.calories;
  const weightProgress = getWeightProgress();
  const now = new Date();
  const subscriptionEndDate = user?.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const isPremiumActive = user?.planType === 'premium' && subscriptionEndDate && subscriptionEndDate > now;
  const isCoupleOwner = isPremiumActive && user?.premiumPackage === 'premium-couple';
  const isCoupleCodeAvailable = isCoupleOwner && !!user?.coupleShareCode && !user?.coupleShareCodeUsed;

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
                    src={user.avatar ? `${url}/uploads/${user.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10b981&color=fff&size=100`} 
                    alt="Avatar" 
                  />
                </div>
                <div className="profile-info">
                  <h2>{user.name}</h2>
                  <div className="profile-plan-badge-row">
                    {isPremiumActive ? (
                      <span className="plan-badge plan-badge--premium">⭐ Premium</span>
                    ) : (
                      <span className="plan-badge plan-badge--free">Free</span>
                    )}
                    {isPremiumActive && subscriptionEndDate && (
                      <span className="plan-expiry">Hết hạn: {subscriptionEndDate.toLocaleDateString('vi-VN')}</span>
                    )}
                  </div>
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

              {/* {user?.planType === 'premium' && (
                <div className="couple-share-card">
                  <h3>Dùng chung Premium Couple</h3>

                  {isCoupleOwner ? (
                    <>
                      <p className="couple-share-subtext">
                        Mã chia sẻ của bạn dùng được 1 lần và hết hạn cùng gói hiện tại.
                      </p>
                      <div className="couple-share-code-row">
                        <div className="couple-share-code">{user?.coupleShareCode || '---'}</div>
                        {isCoupleCodeAvailable ? (
                          <button
                            type="button"
                            className="copy-code-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(user?.coupleShareCode || '');
                              toast.success('Đã sao chép mã chia sẻ');
                            }}
                          >
                            Sao chép
                          </button>
                        ) : (
                          <span className="couple-code-used">Đã dùng</span>
                        )}
                      </div>
                      <p className="couple-share-expiry">
                        Hết hạn: {subscriptionEndDate ? subscriptionEndDate.toLocaleDateString('vi-VN') : 'N/A'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="couple-share-subtext">
                        Nhập mã chia sẻ tại trang thanh toán khi chọn gói Couple để kích hoạt Premium dùng chung.
                      </p>
                    </>
                  )}
                </div>
              )} */}

              <button className="settings-btn" onClick={handleOpenEditModal}>
                Chỉnh sửa
              </button>
            </>
          ) : (
            <div className="modal-overlay" onClick={handleCloseEditModal}>
              <div className="modal-content profile-edit-modal" onClick={(e) => e.stopPropagation()}>
                <div className="edit-profile-form">
                  <h3>Chỉnh sửa thông tin</h3>
              
              <div className="form-group">
                <label>Ảnh đại diện</label>
                <div className="avatar-upload">
                  <div className="avatar-preview">
                    <img 
                      src={avatarFile ? URL.createObjectURL(avatarFile) : (user.avatar ? `${url}/uploads/${user.avatar}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10b981&color=fff&size=100`)} 
                      alt="Avatar preview" 
                    />
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files[0])}
                  />
                </div>
              </div>

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

                  {profileWarnings.length > 0 && (
                    <div className="profile-warning-panel">
                      <h4>Cảnh báo từ AI</h4>
                      <p className="profile-warning-subtitle">
                        Thông tin hiện tại chưa phù hợp để lưu. Vui lòng chỉnh sửa rồi đánh giá lại.
                      </p>
                      <div className="profile-warning-list">
                        {profileWarnings.map((warning, index) => (
                          <div
                            key={`${warning.code || 'warning'}-${index}`}
                            className={`profile-warning-item profile-warning-${warning.severity || 'medium'}`}
                          >
                            <span className="profile-warning-badge">{warning.severity === 'high' ? 'Cao' : 'Vừa'}</span>
                            <div>
                              <p>{warning.message}</p>
                              {warning.detail && <p className="profile-warning-detail">Chi tiết: {warning.detail}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="edit-actions">
                    <button className="save-btn" disabled={isSavingProfile} onClick={handleSaveProfile}>
                      {isSavingProfile ? 'Đang đánh giá...' : profileWarnings.length > 0 ? 'Đánh giá lại' : 'Lưu'}
                    </button>
                    <button className="cancel-btn" disabled={isSavingProfile} onClick={handleCloseEditModal}>Hủy</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Goals Overview */}
        <div className="goals-card">
          <h3>Tổng quan mục tiêu</h3>

          <div className="meal-reminder-panel">
            <div className="meal-reminder-header">
              <div>
                <p className="meal-reminder-title">Nhắc nhở đúng bữa ăn</p>
                <p className="meal-reminder-subtitle">
                  {isPremiumActive
                    ? 'Bật để nhận thông báo vào giờ bạn chọn'
                    : 'Chỉ dành cho tài khoản Premium'}
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={mealReminderSettings.enabled}
                  disabled={!isPremiumActive}
                  onChange={(e) => setMealReminderSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                <span className="slider"></span>
              </label>
            </div>

            {mealReminderSettings.enabled && (
              <div className="meal-time-grid">
                <div className="meal-time-item">
                  <label>Bữa sáng</label>
                  <input
                    type="time"
                    value={mealReminderSettings.breakfastTime}
                    disabled={!isPremiumActive}
                    onChange={(e) => setMealReminderSettings((prev) => ({ ...prev, breakfastTime: e.target.value }))}
                  />
                </div>
                <div className="meal-time-item">
                  <label>Bữa trưa</label>
                  <input
                    type="time"
                    value={mealReminderSettings.lunchTime}
                    disabled={!isPremiumActive}
                    onChange={(e) => setMealReminderSettings((prev) => ({ ...prev, lunchTime: e.target.value }))}
                  />
                </div>
                <div className="meal-time-item">
                  <label>Bữa tối</label>
                  <input
                    type="time"
                    value={mealReminderSettings.dinnerTime}
                    disabled={!isPremiumActive}
                    onChange={(e) => setMealReminderSettings((prev) => ({ ...prev, dinnerTime: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <button className="save-reminder-btn" onClick={handleSaveMealReminderSettings} disabled={!isPremiumActive}>
              Lưu cài đặt nhắc bữa ăn
            </button>
          </div>

          {/* Dark / Light mode */}
          <div className="meal-reminder-panel">
            <div className="meal-reminder-header">
              <div>
                <p className="meal-reminder-title">Giao diện</p>
                <p className="meal-reminder-subtitle">
                  {darkMode ? 'Đang dùng chế độ tối' : 'Đang dùng chế độ sáng'}
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={toggleDarkMode}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

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
                {weightProgress.map((point, index) => {
                  const isSinglePoint = weightProgress.length === 1;
                  const left = isSinglePoint ? 0 : (index / (weightProgress.length - 1)) * 100;
                  return (
                    <div
                      key={index}
                      className="x-label"
                      style={{
                        left: `${left}%`,
                        transform: isSinglePoint ? 'translateX(0)' : 'translateX(-50%)',
                      }}
                    >
                      {point.date}
                    </div>
                  );
                })}
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
