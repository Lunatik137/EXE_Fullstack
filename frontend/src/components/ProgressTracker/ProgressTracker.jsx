import './ProgressTracker.css';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import streakIconSheet from '../../assets/frontend_assets/greenpath_streak_icon_sheet.svg';

const STREAK_ICON_VERSION = '20260531c';
const STREAK_ICON_FRAMES = 6;
const STREAK_BADGE_ICON_SIZE = 80;

const ProgressTracker = ({ loading, subscriptionInfo, streakStatus, recoveringStreak, onRecoverStreak }) => {
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
        <div className="loading-skeleton">
          <p>Đang tải streak...</p>
        </div>
      </div>
    );
  }

  const todayConfirmedMeals = streakStatus?.todayProgress?.confirmedMeals || 0;
  const currentStreak = streakStatus?.currentStreak || 0;
  const longestStreak = streakStatus?.longestStreak || 0;
  const isPremiumUser = subscriptionInfo?.planType === 'premium' && subscriptionInfo?.subscriptionStatus === 'active';
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
            <p className="progress-streak-label">Chuỗi</p>
            <h4 className="progress-streak-value">{currentStreak} ngày</h4>
          </div>
          <div>
            <p className="progress-streak-label">Kỷ lục</p>
            <h4 className="progress-streak-value">{longestStreak} ngày</h4>
          </div>
          <div>
            <p className="progress-streak-label">Hôm nay</p>
            <h4 className="progress-streak-value">{todayConfirmedMeals}/3 bữa</h4>
          </div>
        </div>

        <div className="progress-streak-footer">
          <span>Cần xác nhận tối thiểu 2/3 bữa để giữ chuỗi.</span>
          <span>Phục hồi tháng này: {streakStatus?.recovery?.remainingThisMonth || 0}/1</span>
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

      {isPremiumUser && (
        <button
          className="progress-create-plan-btn"
          onClick={() => navigate('/generate-plan')}
        >
          Tạo lộ trình mới
        </button>
      )}
    </div>
  );
};

ProgressTracker.propTypes = {
  loading: PropTypes.bool,
  subscriptionInfo: PropTypes.object,
  streakStatus: PropTypes.object,
  recoveringStreak: PropTypes.bool,
  onRecoverStreak: PropTypes.func
};

export default ProgressTracker;
