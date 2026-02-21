import './ProgressTracker.css';
import PropTypes from 'prop-types';

const ProgressTracker = ({ mealPlan, loading }) => {
  if (loading) {
    return (
      <div className="progress-tracker">
        <div className="progress-card">
          <div className="loading-skeleton">
            <p>Đang tải tiến độ...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="progress-tracker">
        <div className="progress-card">
          <h3 className="progress-title">Chưa có lộ trình</h3>
          <p className="progress-description">
            Bạn chưa bắt đầu lộ trình nào. Hãy tạo lộ trình đầu tiên của bạn!
          </p>
        </div>
      </div>
    );
  }

  // Calculate progress
  const today = new Date();
  const startDate = new Date(mealPlan.startDate);
  const daysPassed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.min(daysPassed, mealPlan.duration);
  const progressPercentage = Math.round((currentDay / mealPlan.duration) * 100);

  // Get plan name
  const getPlanName = () => {
    if (mealPlan.planType === 'free') {
      return 'Gói dùng thử';
    }
    return 'Gói Premium';
  };

  // Get milestone message based on progress
  const getMilestone = () => {
    if (progressPercentage < 25) {
      return {
        title: 'Mục tiêu giai đoạn 1',
        text: 'Làm quen với việc thay thế thịt bằng đạm thực vật mà không gây mệt mỏi.'
      };
    } else if (progressPercentage < 50) {
      return {
        title: 'Mục tiêu giai đoạn 2',
        text: 'Khám phá thêm các món ăn chay đa dạng và cân bằng dinh dưỡng.'
      };
    } else if (progressPercentage < 75) {
      return {
        title: 'Mục tiêu giai đoạn 3',
        text: 'Duy trì thói quen ăn chay và tối ưu hóa sức khỏe tổng thể.'
      };
    } else {
      return {
        title: 'Mục tiêu cuối cùng',
        text: 'Hoàn thành lộ trình và chuyển sang chế độ ăn chay bền vững.'
      };
    }
  };

  const milestone = getMilestone();

  return (
    <div className="progress-tracker">
      <div className="progress-card">
        <h3 className="progress-title">Lộ trình {mealPlan.duration} ngày</h3>
        <p className="progress-description">
          {getPlanName()} - Chương trình &quot;{mealPlan.dietType === 'vegan' ? 'Ăn chay toàn phần' : 'Healthy lifestyle'}&quot;
        </p>

        <div className="progress-info">
          <div className="progress-label">Tiến độ chung (Ngày {currentDay}/{mealPlan.duration})</div>
          <div className="progress-percentage">{progressPercentage}%</div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }}></div>
        </div>

        <div className="milestone-card">
          <div className="milestone-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-bullseye" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
              <path d="M8 13A5 5 0 1 1 8 3a5 5 0 0 1 0 10m0 1A6 6 0 1 0 8 2a6 6 0 0 0 0 12"/>
              <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8"/>
              <path d="M9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
            </svg>
          </div>
          <div className="milestone-content">
            <h4 className="milestone-title">{milestone.title}</h4>
            <p className="milestone-text">{milestone.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

ProgressTracker.propTypes = {
  mealPlan: PropTypes.object,
  loading: PropTypes.bool
};

export default ProgressTracker;
