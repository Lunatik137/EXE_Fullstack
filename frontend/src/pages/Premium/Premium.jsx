import { useState } from 'react';
import './Premium.css';

const Premium = () => {
  return (
    <div className="premium-page">
      <div className="premium-container">
        <div className="premium-header-section">
          <h1>Nâng cấp Greenpath Premium</h1>
          <p className="premium-subtitle">Mở khoá toàn bộ tiềm năng sức khoẻ của bạn với chi phí bằng một cốc cà phê.</p>
        </div>

        <div className="pricing-cards">
          {/* Free Plan */}
          <div className="pricing-card free-card">
            <div className="card-header">
              <p className="plan-label">Cơ bản</p>
              <h2 className="plan-price">Miễn phí</h2>
            </div>

            <div className="features-list">
              <div className="feature-item">
                <span className="check-icon">✓</span>
                <span>Thực đơn cơ bản hằng ngày</span>
              </div>
              <div className="feature-item">
                <span className="check-icon">✓</span>
                <span>Tham gia cộng đồng</span>
              </div>
              <div className="feature-item">
                <span className="check-icon">✓</span>
                <span>Theo dõi tiến độ đơn giản</span>
              </div>
            </div>

            <button className="plan-btn current-plan-btn">Gói hiện tại</button>
          </div>

          {/* Premium Plan */}
          <div className="pricing-card premium-card">
            <div className="recommended-badge">ĐỀ XUẤT</div>
            <div className="card-header">
              <p className="plan-label premium-label">Premium</p>
              <div className="price-section">
                <h2 className="plan-price">79k <span className="price-period">/tháng</span></h2>
                <p className="discount-info">Hoặc 799k / năm (Tiết kiệm 20%)</p>
              </div>
            </div>

            <div className="features-list premium-features">
              <div className="feature-item premium-feature">
                <span className="star-icon">⭐</span>
                <span>Lộ trình chuyên sâu (Giảm cân, Tăng cơ)</span>
              </div>
              <div className="feature-item premium-feature">
                <span className="star-icon">⭐</span>
                <span>Công thức độc quyền từ chuyên gia</span>
              </div>
              <div className="feature-item premium-feature">
                <span className="star-icon">⭐</span>
                <span>Phân tích vi chất chi tiết</span>
              </div>
              <div className="feature-item premium-feature">
                <span className="star-icon">⭐</span>
                <span>Tắt quảng cáo</span>
              </div>
            </div>

            <button className="plan-btn premium-btn">Đăng ký ngay</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Premium;
