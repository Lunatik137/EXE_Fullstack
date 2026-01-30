import './ProgressTracker.css';

const ProgressTracker = () => {
  return (
    <div className="progress-tracker">
      <div className="progress-card">
        <h3 className="progress-title">Lộ trình 14 ngày</h3>
        <p className="progress-description">
          Chương trình "Nhập môn ăn chay" dành cho người mới bắt đầu.
        </p>

        <div className="progress-info">
          <div className="progress-label">Tiến độ chung</div>
          <div className="progress-percentage">25%</div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: '25%' }}></div>
        </div>

        <div className="milestone-card">
          <div className="milestone-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-bullseye" viewBox="0 0 16 16">
  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
  <path d="M8 13A5 5 0 1 1 8 3a5 5 0 0 1 0 10m0 1A6 6 0 1 0 8 2a6 6 0 0 0 0 12"/>
  <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8"/>
  <path d="M9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
</svg></div>
          <div className="milestone-content">
            <h4 className="milestone-title">Mục tiêu giai đoạn 1</h4>
            <p className="milestone-text">
              Làm quen với việc thay thế thịt bằng đạm thực vật mà không gây mệt mỏi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;
