import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useContext } from 'react';
import { toast } from 'react-toastify';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import './Payment.css';

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { url, token } = useContext(StoreContext);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMockPayment = async () => {
    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Save premium status to backend
      const response = await axios.post(
        `${url}/api/user/confirm-premium`,
        { planType: 'premium' },
        { headers: { token } }
      );

      if (response.data.success) {
        toast.success('Thanh toán thành công! Nâng cấp thành Premium');
        navigate('/home');
      } else {
        toast.error(response.data.message || 'Đã có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Thanh toán thất bại. Vui lòng thử lại!');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    navigate('/plan-price');
  };

  return (
    <div className="payment-container">
      <div className="payment-content">
        <button 
          className="btn-close"
          onClick={handleCancel}
          disabled={isProcessing}
        >
          ✕
        </button>

        <div className="payment-header">
          <h1>Thanh Toán</h1>
          <p>Xác nhận thanh toán để nâng cấp lên Premium</p>
        </div>

        <div className="payment-card">
          <div className="payment-summary">
            <h2>GreenPath Premium</h2>
            <p className="price">39,000đ<span>/tháng</span></p>
            <p className="period-text">Đầu tiên sẽ mất 39,000đ, sau đó tự động gia hạn hàng tháng</p>
          </div>

          <div className="payment-features">
            <h3>Bạn sẽ nhận được:</h3>
            <ul>
              <li>✓ Lộ trình ăn chay 14-90 ngày</li>
              <li>✓ Công thức độc quyền từ chuyên gia</li>
              <li>✓ Cá nhân hóa chi tiết macro & thời gian nấu</li>
              <li>✓ AI coach & tùy chỉnh món ăn</li>
              <li>✓ Theo dõi tiến độ chi tiết</li>
              <li>✓ Không có quảng cáo</li>
            </ul>
          </div>

          <div className="payment-note">
            <p>💡 <strong>Lưu ý:</strong> Đây là trang thanh toán placeholder. Trong bản production, bạn có thể tích hợp Stripe, VNPay hoặc các cổng thanh toán khác.</p>
          </div>

          <div className="payment-actions">
            <button 
              className="btn-cancel"
              onClick={handleCancel}
              disabled={isProcessing}
            >
              Hủy
            </button>
            <button 
              className="btn-pay"
              onClick={handleMockPayment}
              disabled={isProcessing}
            >
              {isProcessing ? '⏳ Đang xử lý...' : '✓ Thanh toán 39,000đ'}
            </button>
          </div>
        </div>

        <div className="payment-footer">
          <p>Thanh toán an toàn • Dữ liệu được bảo vệ</p>
        </div>
      </div>
    </div>
  );
};

export default Payment;
