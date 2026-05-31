import './ProgressTracker.css';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import streakIconSheet from '../../assets/frontend_assets/greenpath_streak_icon_sheet.svg';

const STREAK_ICON_VERSION = '20260531c';
const STREAK_ICON_FRAMES = 6;
const STREAK_BADGE_ICON_SIZE = 80;

const ProgressTracker = ({ mealPlan, loading, subscriptionInfo, streakStatus, recoveringStreak, onRecoverStreak }) => {
  const navigate = useNavigate();

  const getStreakFlameIconIndex = (streakDays = 0) => {
    if (streakDays < 3) return 0;
    if (streakDays < 7) return 1;
    if (streakDays < 14) return 2;
    if (streakDays < 30) return 3;
    if (streakDays < 90) return 4;
    return 5;
  };

  const getStreakTier = (streakDays = 0) => {
    if (streakDays < 3) {
      return { key: 'seed', label: 'Seed Tier' };
    }
    if (streakDays < 7) {
      return { key: 'sprout', label: 'Sprout Tier' };
    }
    if (streakDays < 14) {
      return { key: 'growth', label: 'Growth Tier' };
    }
    if (streakDays < 30) {
      return { key: 'forest', label: 'Forest Tier' };
    }
    if (streakDays < 90) {
      return { key: 'flame', label: 'Flame Tier' };
    }

    return { key: 'legendary', label: 'Legendary Tier' };
  };

  const getStreakMessage = (streakDays = 0, lostStreak = false) => {
    if (lostStreak) {
      return 'Bạn vừa mất chuỗi, hãy phục hồi ngay để giữ nhịp hành trình.';
    }
    if (streakDays >= 90) {
      return 'Danh hiệu huyền thoại! Bạn đang duy trì thói quen khỏe mạnh ở đẳng cấp rất hiếm.';
    }
    if (streakDays >= 30) {
      return 'Phong độ rực cháy, bạn đang duy trì kỷ luật ăn uống ổn định và mạnh mẽ mỗi ngày.';
    }
    if (streakDays >= 14) {
      return 'Rất tốt, bạn đã tạo được nhịp ăn đều và ổn định suốt nhiều ngày.';
    }
    if (streakDays >= 7) {
      return 'Đã vào guồng, chỉ cần giữ đều mỗi ngày để lên tier tiếp theo.';
    }
    if (streakDays >= 3) {
      return 'Đà đang lên, cố gắng giữ chuỗi qua tuần này.';
    }

    return 'Khởi động nhẹ nhàng, xác nhận bữa hằng ngày để bắt đầu chuỗi mới.';
  };

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

  // Calculate progress — only count days that have fully passed
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(mealPlan.startDate);
  startDate.setHours(0, 0, 0, 0);
  const daysPassed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  const completedDays = Math.min(Math.max(daysPassed, 0), mealPlan.duration);
  const progressPercentage = Math.round((completedDays / mealPlan.duration) * 100);
  const currentDay = Math.min(daysPassed + 1, mealPlan.duration);
  const isPremiumUser = subscriptionInfo?.planType === 'premium' && subscriptionInfo?.subscriptionStatus === 'active';

  // Get plan name
  const getPlanName = () => {
    if (mealPlan.planType === 'free') {
      return 'Gói miễn phí';
    }
    return 'Gói Premium';
  };

  const todayConfirmedMeals = streakStatus?.todayProgress?.confirmedMeals || 0;
  const currentStreak = streakStatus?.currentStreak || 0;
  const tier = getStreakTier(currentStreak);
  const hasLostStreak = Boolean(streakStatus && streakStatus.currentStreak === 0 && streakStatus.longestStreak > 0 && streakStatus.lastMissedDateKey);
  const canRecoverStreak = Boolean(hasLostStreak && streakStatus?.recovery?.remainingThisMonth && streakStatus?.recovery?.recoverableDateKey);
  const streakMessage = getStreakMessage(currentStreak, hasLostStreak);
  const streakIconIndex = getStreakFlameIconIndex(currentStreak);
  const streakFlameStyle = {
    backgroundImage: `url(${streakIconSheet}?v=${STREAK_ICON_VERSION})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${STREAK_BADGE_ICON_SIZE * STREAK_ICON_FRAMES}px ${STREAK_BADGE_ICON_SIZE}px`,
    backgroundPosition: `${-STREAK_BADGE_ICON_SIZE * streakIconIndex}px center`
  };

  return (
    <div className="progress-tracker">
      <div className="progress-card">
        <div className="progress-non-streak">
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
        </div>

        {streakStatus && (
          <div className={`progress-streak-summary-card tier-${tier.key}`}>
            <div className="progress-streak-spotlight">
              <div>
                <p className="progress-streak-kicker">Streak Mode</p>
                <h4 className="progress-streak-hero">{tier.label}</h4>
                <p className="progress-streak-copy">{streakMessage}</p>
              </div>
              <div className="progress-streak-flame" aria-label="Streak achievement badge">
                <div className="progress-streak-flame-icon" style={streakFlameStyle} />
              </div>
            </div>
            <div className="progress-streak-grid">
              <div>
                <p className="progress-streak-label">
                  Chuỗi
                </p>
                <h4 className="progress-streak-value">{streakStatus.currentStreak} ngày</h4>
              </div>
              <div>
                <p className="progress-streak-label">
                  Kỷ lục
                </p>
                <h4 className="progress-streak-value">{streakStatus.longestStreak} ngày</h4>
              </div>
              <div>
                <p className="progress-streak-label">
                  Hôm nay
                </p>
                <h4 className="progress-streak-value">{todayConfirmedMeals}/3 bữa</h4>
              </div>
            </div>
            <div className="progress-streak-footer">
              <span>Cần xác nhận tối thiểu 2/3 bữa để giữ chuỗi.</span>
              <span>Phục hồi tháng này: {streakStatus.recovery?.remainingThisMonth || 0}/1</span>
            </div>

            {hasLostStreak && (
              <div className="progress-streak-recovery-row">
                <div>
                  <p className="progress-streak-recovery-title">Mất chuỗi - phục hồi ngay</p>
                  <p className="progress-streak-recovery-text">
                    {streakStatus.recovery?.recoverableDateKey
                      ? `Bạn có thể cứu lại ngày ${streakStatus.recovery.recoverableDateKey}.`
                      : 'Chưa có ngày nào đủ điều kiện để phục hồi.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="progress-streak-recover-btn"
                  onClick={onRecoverStreak}
                  disabled={!canRecoverStreak || recoveringStreak}
                >
                  {recoveringStreak ? 'Đang phục hồi...' : 'Phục hồi chuỗi'}
                </button>
              </div>
            )}
          </div>
        )}

        {isPremiumUser && (
          <button
            className="progress-create-plan-btn progress-non-streak"
            onClick={() => navigate('/generate-plan')}
          >
            Tạo lộ trình mới
          </button>
        )}
      </div>
    </div>
  );
};

ProgressTracker.propTypes = {
  mealPlan: PropTypes.object,
  loading: PropTypes.bool,
  subscriptionInfo: PropTypes.object,
  streakStatus: PropTypes.object,
  recoveringStreak: PropTypes.bool,
  onRecoverStreak: PropTypes.func
};

export default ProgressTracker;
