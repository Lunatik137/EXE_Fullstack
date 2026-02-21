import { useState, useEffect, useContext } from 'react';
import './Profile.css';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';

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
    height: '',
    targetWeight: '',
    goal: '',
    activityLevel: ''
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
          height: response.data.user.onboardingData?.height || '',
          targetWeight: response.data.user.onboardingData?.targetWeight || '',
          goal: response.data.user.onboardingData?.goal || '',
          activityLevel: response.data.user.onboardingData?.activityLevel || ''
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

  const handleSaveProfile = async () => {
    try {
      const response = await axios.post(`${url}/api/user/update-profile`, {
        name: editedProfile.name,
        onboardingData: {
          ...user.onboardingData,
          age: editedProfile.age,
          height: editedProfile.height,
          targetWeight: editedProfile.targetWeight,
          goal: editedProfile.goal,
          activityLevel: editedProfile.activityLevel
        }
      }, {
        headers: { token }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
        setIsEditing(false);
        alert('Cập nhật thành công!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Có lỗi xảy ra khi cập nhật!');
    }
  };

  const handleAddWeight = async () => {
    if (!newWeight || newWeight <= 0) {
      alert('Vui lòng nhập cân nặng hợp lệ!');
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
        alert('Đã cập nhật cân nặng!');
      }
    } catch (error) {
      console.error('Error adding weight:', error);
      alert('Có lỗi xảy ra!');
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
    if (weightHistory.length < 2) return [];
    
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
                  <p className="profile-age">{user.onboardingData?.age || 'N/A'} tuổi</p>
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
                <label>Chiều cao (cm)</label>
                <input 
                  type="number" 
                  value={editedProfile.height}
                  onChange={(e) => setEditedProfile({...editedProfile, height: e.target.value})}
                />
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
                <label>Mục tiêu</label>
                <select 
                  value={editedProfile.goal}
                  onChange={(e) => setEditedProfile({...editedProfile, goal: e.target.value})}
                >
                  <option value="lose">Giảm cân</option>
                  <option value="maintain">Duy trì</option>
                  <option value="gain">Tăng cân</option>
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
                  <option value="moderate">Trung bình (3-5 ngày/tuần)</option>
                  <option value="active">Hoạt động (6-7 ngày/tuần)</option>
                  <option value="very_active">Rất năng động</option>
                </select>
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
                  {weightProgress.map((point, index) => {
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
                  const bottom = ((point.weight - minWeight) / range) * 80 + 10;
                  
                  return (
                    <div 
                      key={index} 
                      className="chart-point"
                      style={{
                        left: `${(index / (weightProgress.length - 1)) * 100}%`,
                        bottom: `${bottom}%`
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
