import './TodayMenu.css';

const TodayMenu = () => {
  const currentDate = new Date();
  const dayOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][currentDate.getDay()];
  const dateString = currentDate.toLocaleDateString('vi-VN');

  return (
    <div className="today-menu">
      <div className="menu-date">
        {dayOfWeek}, {dateString}
      </div>
      <h1 className="menu-greeting">Chào Trang 🌸</h1>

      <div className="menu-card">
        <div className="menu-card-header">
          <div>
            <h2 className="menu-title">Thực đơn hôm nay</h2>
            <p className="menu-subtitle">Dựa trên sở thích "Healthy it đấu" của bạn</p>
          </div>
          <div className="day-badge">Day 3/14</div>
        </div>

        <div className="meals-grid">
          <div className="meal-card breakfast">
            <div className="meal-label">BỮA SÁNG</div>
            <div className="meal-name">Cháo yến mạch nấm</div>
          </div>

          <div className="meal-card lunch">
            <div className="meal-label">BỮA TRƯA</div>
            <div className="meal-name">Cơm gạo lứt + đậu hũ sốt me</div>
          </div>

          <div className="meal-card dinner">
            <div className="meal-label">BỮA TỐI</div>
            <div className="meal-name">Mì Ý sốt cà chua tự nhiên</div>
          </div>
        </div>

        <button className="view-details-btn">
          Xem chi tiết công thức →
        </button>
      </div>
    </div>
  );
};

export default TodayMenu;
