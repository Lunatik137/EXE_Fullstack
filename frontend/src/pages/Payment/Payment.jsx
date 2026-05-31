import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useContext, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import './Payment.css';

const PREMIUM_PACKAGES = [
  {
    id: 'premium-1-month',
    title: 'Premium 1 tháng',
    price: 69000,
    durationLabel: '/tháng',
    billingNote: 'Thanh toán một lần cho 30 ngày trải nghiệm Premium đầy đủ.',
    highlight: 'Linh hoạt',
    monthlySaving: null,
  },
  {
    id: 'premium-3-month',
    title: 'Premium 3 tháng',
    price: 179000,
    durationLabel: '/3 tháng',
    billingNote: 'Lựa chọn cân bằng cho người muốn duy trì lộ trình dài hơn.',
    highlight: 'Phổ biến',
    monthlySaving: 14, // 179k/3 = ~59.7k/th vs 69k/th
  },
  {
    id: 'premium-12-month',
    title: 'Premium 12 tháng',
    price: 549000,
    durationLabel: '/năm',
    billingNote: 'Tiết kiệm hơn cho hành trình chăm sóc sức khỏe lâu dài.',
    highlight: 'Tiết kiệm nhất',
    monthlySaving: 34, // 549k/12 = ~45.8k/th vs 69k/th
  },
  // Gói Couple tạm ẩn
  // { id: 'premium-couple', ... }
];

const PACKAGE_DURATION_DAYS = {
  'premium-1-month': 30,
  'premium-3-month': 90,
  'premium-12-month': 365,
  'premium-couple': 30,
};

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN').format(amount);

const resolveQrImageSrc = (qrData) => {
  const directImage = qrData?.qrImageUrl || qrData?.qrCode;
  if (!directImage) return '';

  if (String(directImage).startsWith('http://') || String(directImage).startsWith('https://') || String(directImage).startsWith('data:image/')) {
    return directImage;
  }

  // Fallback: qrCode may be raw payload string, convert via a QR image service
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(String(directImage))}`;
};

// ─── Payment states ───────────────────────────────────────────────────────────
// idle → loading → qr (polling) → success / error / expired

const COUNTDOWN_SECONDS = 15 * 60; // 15 phút để quét QR
const POLL_INTERVAL_MS = 3000;
const PAYOS_PENDING_ORDER_KEY = 'payosPendingOrderCode';
const PAYOS_PENDING_PACKAGE_KEY = 'payosPendingPackage';
const COUPLE_CODE_FETCH_RETRIES = 5;
const COUPLE_CODE_FETCH_DELAY_MS = 900;

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { url, token } = useContext(StoreContext);

  const initialPackageId = PREMIUM_PACKAGES.some((item) => item.id === location.state?.packageId)
    ? location.state.packageId
    : 'premium-3-month';
  const [selectedPackageId, setSelectedPackageId] = useState(initialPackageId);

  // PayOS flow state
  const [payState, setPayState] = useState('idle'); // idle | loading | qr | confirming | success | error | expired
  const [qrData, setQrData] = useState(null); // { qrCode, checkoutUrl, orderCode, amount, description }
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [errorMsg, setErrorMsg] = useState('');
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const [coupleShareCode, setCoupleShareCode] = useState('');
  const [isCouplePaymentSuccess, setIsCouplePaymentSuccess] = useState(false);

  // Voucher state
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null); // { code, discountPercent }
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  const selectedPackage = PREMIUM_PACKAGES.find((item) => item.id === selectedPackageId) || PREMIUM_PACKAGES[1];
  const packageDurationDays = PACKAGE_DURATION_DAYS[selectedPackage.id] || 30;
  const discountedPrice = appliedVoucher
    ? Math.max(1000, Math.round(selectedPackage.price * (1 - appliedVoucher.discountPercent / 100)))
    : selectedPackage.price;

  // ── Cleanup timers on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  // ── Handle PayOS redirect back (returnUrl / cancelUrl) ───────────────────
  useEffect(() => {
    const result = searchParams.get('result');
    const orderCode = searchParams.get('orderCode');
    if (!result || !orderCode) return;

    if (result === 'success') {
      handleConfirmAfterRedirect(orderCode);
    } else {
      setPayState('error');
      setErrorMsg('Thanh toán đã bị hủy hoặc thất bại.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Stop polling helpers ──────────────────────────────────────────────────
  const stopPolling = () => {
    clearInterval(pollRef.current);
    clearInterval(countdownRef.current);
    pollRef.current = null;
    countdownRef.current = null;
  };

  const setPendingPaymentMeta = (orderCode, packageId) => {
    if (!orderCode || !packageId) return;
    sessionStorage.setItem(PAYOS_PENDING_ORDER_KEY, String(orderCode));
    sessionStorage.setItem(PAYOS_PENDING_PACKAGE_KEY, String(packageId));
  };

  const resolvePendingPackageForOrder = (orderCode) => {
    const pendingOrderCode = sessionStorage.getItem(PAYOS_PENDING_ORDER_KEY);
    const pendingPackage = sessionStorage.getItem(PAYOS_PENDING_PACKAGE_KEY);
    if (pendingOrderCode && pendingPackage && String(pendingOrderCode) === String(orderCode)) {
      return pendingPackage;
    }
    return '';
  };

  const clearPendingPaymentMeta = () => {
    sessionStorage.removeItem(PAYOS_PENDING_ORDER_KEY);
    sessionStorage.removeItem(PAYOS_PENDING_PACKAGE_KEY);
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchLatestCoupleShareCode = async () => {
    for (let attempt = 0; attempt < COUPLE_CODE_FETCH_RETRIES; attempt += 1) {
      try {
        const profileRes = await axios.post(`${url}/api/user/profile`, {}, { headers: { token } });
        if (profileRes.data?.success) {
          const code = String(profileRes.data?.user?.coupleShareCode || '').trim().toUpperCase();
          if (code) return code;
        }
      } catch {
        // Keep retrying for a short time because webhook/DB update may be slightly delayed.
      }

      if (attempt < COUPLE_CODE_FETCH_RETRIES - 1) {
        await sleep(COUPLE_CODE_FETCH_DELAY_MS);
      }
    }

    return '';
  };

  // ── Confirm payment via backend (verifies with PayOS) ─────────────────────
  const handleConfirmAfterRedirect = async (orderCode) => {
    setPayState('confirming');
    try {
      const res = await axios.post(
        `${url}/api/payos/confirm-payment`,
        { orderCode },
        { headers: { token } }
      );
      if (res.data.success) {
        const resolvedPackage = res.data.premiumPackage || resolvePendingPackageForOrder(orderCode);
        const isCouplePackage = resolvedPackage === 'premium-couple';
        setIsCouplePaymentSuccess(isCouplePackage);
        let confirmedCoupleCode = String(res.data.coupleShareCode || '').trim().toUpperCase();
        if (isCouplePackage && !confirmedCoupleCode) {
          confirmedCoupleCode = await fetchLatestCoupleShareCode();
        }
        setCoupleShareCode(isCouplePackage ? confirmedCoupleCode : '');
        setPayState('success');
        toast.success(res.data.message || 'Kích hoạt Premium thành công!');
        if (!isCouplePackage) {
          clearPendingPaymentMeta();
          setTimeout(() => navigate('/home'), 3000);
        }
      } else {
        setPayState('error');
        setErrorMsg(res.data.message || 'Xác nhận thanh toán thất bại.');
      }
    } catch {
      setPayState('error');
      setErrorMsg('Lỗi kết nối khi xác nhận thanh toán.');
    }
  };

  // ── Start PayOS payment ───────────────────────────────────────────────────
  const handlePayosPayment = async () => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để thanh toán!');
      return;
    }
    setPayState('loading');
    setErrorMsg('');
    try {
      const res = await axios.post(
        `${url}/api/payos/create-payment`,
        { premiumPackage: selectedPackage.id, voucherCode: appliedVoucher?.code || null },
        { headers: { token } }
      );
      if (!res.data.success) {
        setPayState('idle');
        toast.error(res.data.message || 'Không thể tạo link thanh toán');
        return;
      }
      setPendingPaymentMeta(res.data.orderCode, selectedPackage.id);
      setQrData(res.data);
      setQrLoadFailed(false);
      setCountdown(COUNTDOWN_SECONDS);
      setPayState('qr');
      startPolling(res.data.orderCode);
      startCountdown();
    } catch (err) {
      console.error('PayOS create-payment error:', err);
      setPayState('idle');
      toast.error('Lỗi kết nối tới PayOS. Vui lòng thử lại!');
    }
  };

  // ── Apply voucher discount ─────────────────────────────────────────
  const handleApplyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) { setVoucherError('Vui lòng nhập mã ưu đãi'); return; }
    if (!token) { toast.error('Vui lòng đăng nhập'); return; }
    setVoucherError('');
    setIsCheckingVoucher(true);
    try {
      const res = await axios.post(`${url}/api/voucher/apply`, { code }, { headers: { token } });
      if (res.data.success) {
        setAppliedVoucher({ code, discountPercent: res.data.discountPercent });
        setVoucherInput('');
      } else {
        setVoucherError(res.data.message || 'Mã không hợp lệ hoặc đã được sử dụng');
      }
    } catch {
      setVoucherError('Không thể kiểm tra mã. Vui lòng thử lại!');
    } finally {
      setIsCheckingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
  };

  // ── Poll payment status every 3s ─────────────────────────────────────────
  const startPolling = (orderCode) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(
          `${url}/api/payos/check-payment/${orderCode}`,
          { headers: { token } }
        );
        if (!res.data.success) return;
        const status = res.data.status;
        if (status === 'PAID') {
          stopPolling();
          await confirmAfterPaid(orderCode);
        } else if (status === 'CANCELLED') {
          stopPolling();
          setPayState('error');
          setErrorMsg('Thanh toán đã bị hủy.');
        }
      } catch {
        // network hiccup – keep polling
      }
    }, POLL_INTERVAL_MS);
  };

  // ── Countdown timer ───────────────────────────────────────────────────────
  const startCountdown = () => {
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopPolling();
          setPayState('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Confirm after polling sees PAID ───────────────────────────────────────
  const confirmAfterPaid = async (orderCode) => {
    setPayState('confirming');
    try {
      const res = await axios.post(
        `${url}/api/payos/confirm-payment`,
        { orderCode },
        { headers: { token } }
      );
      if (res.data.success) {
        const resolvedPackage = res.data.premiumPackage || resolvePendingPackageForOrder(orderCode) || selectedPackage.id;
        const isCouplePackage = resolvedPackage === 'premium-couple';
        setIsCouplePaymentSuccess(isCouplePackage);
        let confirmedCoupleCode = String(res.data.coupleShareCode || '').trim().toUpperCase();
        if (isCouplePackage && !confirmedCoupleCode) {
          confirmedCoupleCode = await fetchLatestCoupleShareCode();
        }
        setCoupleShareCode(isCouplePackage ? confirmedCoupleCode : '');
        setPayState('success');
        toast.success(res.data.message || 'Kích hoạt Premium thành công!');
        if (!isCouplePackage) {
          clearPendingPaymentMeta();
          setTimeout(() => navigate('/home'), 3000);
        }
      } else {
        // Webhook may have already activated — check
        setCoupleShareCode('');
        setPayState('success');
        toast.success('Premium đã được kích hoạt!');
        setTimeout(() => navigate('/home'), 3000);
      }
    } catch {
      setCoupleShareCode('');
      setPayState('success');
      toast.success('Thanh toán thành công!');
      setTimeout(() => navigate('/home'), 3000);
    }
  };

  // ── Reset to re-try ───────────────────────────────────────────────────────
  const handleRetry = () => {
    stopPolling();
    clearPendingPaymentMeta();
    setQrData(null);
    setQrLoadFailed(false);
    setCoupleShareCode('');
    setIsCouplePaymentSuccess(false);
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
    setPayState('idle');
    setErrorMsg('');
  };

  const handleCancelQR = async () => {
    stopPolling();
    clearPendingPaymentMeta();
    if (qrData?.orderCode) {
      // Optionally cancel on PayOS side (fire and forget)
      axios.delete?.(`${url}/api/payos/cancel/${qrData.orderCode}`, { headers: { token } }).catch(() => {});
    }
    setQrData(null);
    setQrLoadFailed(false);
    setCoupleShareCode('');
    setIsCouplePaymentSuccess(false);
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
    setPayState('idle');
  };

  const handleCancel = () => {
    stopPolling();
    navigate(-1);
  };

  const handleCopyCoupleCode = async () => {
    const code = String(coupleShareCode || '').trim();
    if (!code) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        toast.success('Đã sao chép mã chia sẻ');
      } else {
        toast.error('Trình duyệt không hỗ trợ sao chép tự động');
      }
    } catch {
      toast.error('Không thể sao chép mã, vui lòng thử lại');
    }
  };

  const handleCloseSuccess = () => {
    clearPendingPaymentMeta();
    setIsCouplePaymentSuccess(false);
    navigate('/home');
  };

  const handleReloadCoupleCode = async () => {
    const code = await fetchLatestCoupleShareCode();
    if (code) {
      setCoupleShareCode(code);
      toast.success('Đã cập nhật mã chia sẻ');
    } else {
      toast.error('Chưa lấy được mã chia sẻ, vui lòng thử lại sau vài giây');
    }
  };

  // ── Format countdown mm:ss ────────────────────────────────────────────────
  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="payment-container">
      <div className="payment-content">

        <div className="payment-header">
          <span className="payment-kicker">GreenPath Premium</span>
          <h1>Chọn gói thanh toán phù hợp với hành trình của bạn</h1>
        </div>

        <div className="payment-card">
          <div className="payment-grid">
            <div className="package-selector">
              <div className="section-heading">
                <h2>3 gói premium</h2>
                <p>Chọn một gói để xem tổng thanh toán và quyền lợi tương ứng.</p>
              </div>

              <div className="package-list">
                {PREMIUM_PACKAGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`package-card ${selectedPackageId === item.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPackageId(item.id)}
                    disabled={payState !== 'idle'}
                  >
                    <div className="package-card-top">
                      <span className="package-badge">{item.highlight}</span>
                      <span className="package-radio" aria-hidden="true" />
                    </div>
                    <h3>{item.title}</h3>
                    <p className="package-price">
                      {formatCurrency(item.price)}đ
                      <span>{item.durationLabel}</span>
                    </p>
                    {item.monthlySaving && (
                      <div className="package-saving-badge">
                        Tiết kiệm {item.monthlySaving}% so với gói tháng
                      </div>
                    )}
                    <p className="package-note">{item.billingNote}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="payment-summary-panel">
              <div className="payment-summary">
                <span className="summary-badge">Đang chọn</span>
                <h2>{selectedPackage.title}</h2>
                {appliedVoucher ? (
                  <div className="price-with-discount">
                    <span className="price-original">
                      {formatCurrency(selectedPackage.price)}đ
                    </span>
                    <p className="price">
                      {formatCurrency(discountedPrice)}đ<span>{selectedPackage.durationLabel}</span>
                    </p>
                  </div>
                ) : (
                  <p className="price">{formatCurrency(selectedPackage.price)}đ<span>{selectedPackage.durationLabel}</span></p>
                )}
                <p className="period-text">
                  Thanh toán hôm nay {formatCurrency(discountedPrice)}đ.
                  {appliedVoucher && <span className="period-discount-tag">Đã giảm {appliedVoucher.discountPercent}%</span>}
                  {' '}Gói sẽ kích hoạt ngay sau khi xác nhận.
                </p>
              </div>

              <div className="payment-features">
                <h3>Bạn sẽ nhận được:</h3>
                <ul>
                  <li><span>✓</span><span>Lộ trình ăn chay cá nhân hoá và gợi ý thực đơn theo mục tiêu.</span></li>
                  <li><span>✓</span><span>Công thức độc quyền từ chuyên gia và mẹo thay thế nguyên liệu.</span></li>
                  <li><span>✓</span><span>Cá nhân hóa macro, lượng calo và thời gian nấu cho từng ngày.</span></li>
                  <li><span>✓</span><span>Thông báo nhắc nhở đúng bữa ăn theo giờ tùy chỉnh cho tài khoản premium.</span></li>
                  <li><span>✓</span><span>AI coach hỗ trợ điều chỉnh món ăn, routine và cách duy trì kỷ luật.</span></li>
                  <li><span>✓</span><span>Theo dõi tiến độ chi tiết, không quảng cáo, ưu tiên trải nghiệm premium.</span></li>
                </ul>
              </div>

              <div className="payment-meta">
                <div>
                  <span>Thời hạn gói</span>
                  <strong>{packageDurationDays} ngày</strong>
                </div>
                <div>
                  <span>Hình thức</span>
                  <strong>QR Code</strong>
                </div>
              </div>

              {/* ── PayOS QR panel ──────────────────────────────────────── */}
              {payState === 'qr' || payState === 'confirming' || payState === 'expired' ? (
                <div className="payos-qr-panel">
                  {payState === 'expired' ? (
                    <div className="payos-status expired">
                      <span className="payos-status-icon">⏱</span>
                      <p>Mã QR đã hết hạn</p>
                      <button className="btn-pay" onClick={handleRetry}>Tạo mã mới</button>
                    </div>
                  ) : payState === 'confirming' ? (
                    <div className="payos-status confirming">
                      <span className="payos-status-icon spin">⟳</span>
                      <p>Đang xác nhận thanh toán…</p>
                    </div>
                  ) : (
                    <>
                      <p className="payos-qr-title">Quét mã QR để thanh toán</p>
                      <div className="payos-qr-wrap">
                        {resolveQrImageSrc(qrData) && !qrLoadFailed ? (
                          <img
                            src={resolveQrImageSrc(qrData)}
                            alt="PayOS QR Code"
                            className="payos-qr-img"
                            onError={() => setQrLoadFailed(true)}
                          />
                        ) : (
                          <div className="payos-qr-placeholder">Không tải được QR</div>
                        )}
                      </div>
                      <p className="payos-qr-amount">{formatCurrency(qrData?.amount || 0)}đ</p>
                      <p className="payos-qr-sub">{qrData?.description}</p>
                      <div className="payos-countdown">
                        <span>⏱ Còn: <strong>{formatCountdown(countdown)}</strong></span>
                      </div>
                      <a
                        href={qrData?.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-payos-open"
                      >
                        Mở trang PayOS ↗
                      </a>
                      <button className="btn-cancel" onClick={handleCancelQR}>
                        Hủy thanh toán
                      </button>
                    </>
                  )}
                </div>
              ) : payState === 'success' ? (
                <div className="payos-status success">
                  <span className="payos-status-icon">✓</span>
                  <p>Thanh toán thành công!</p>
                  {isCouplePaymentSuccess ? (
                    <>
                      <p className="payos-status-sub">Đây là mã chia sẻ gói Couple của bạn</p>
                      <div className="couple-share-code-box">
                        <span>{coupleShareCode || 'DANG DONG BO...'}</span>
                        {coupleShareCode ? (
                          <button type="button" className="btn-copy-code" onClick={handleCopyCoupleCode}>
                            Sao chép
                          </button>
                        ) : (
                          <button type="button" className="btn-copy-code" onClick={handleReloadCoupleCode}>
                            Tải lại mã
                          </button>
                        )}
                      </div>
                      <button type="button" className="btn-pay" onClick={handleCloseSuccess}>
                        Đóng
                      </button>
                    </>
                  ) : (
                    <p className="payos-status-sub">Đang chuyển hướng…</p>
                  )}
                </div>
              ) : payState === 'error' ? (
                <div className="payos-status error">
                  <span className="payos-status-icon">✗</span>
                  <p>{errorMsg || 'Thanh toán thất bại'}</p>
                  <div className="payment-actions">
                    <button className="btn-cancel" onClick={handleCancel}>Quay lại</button>
                    <button className="btn-pay" onClick={handleRetry}>Thử lại</button>
                  </div>
                </div>
              ) : (
                <>  
                  {/* Voucher – Premium fintech redesign */}
                  <div className="vc-section">

                    {appliedVoucher ? (
                      <div className="vc-applied">
                        <div className="vc-applied-check" aria-hidden="true">✓</div>
                        <div className="vc-applied-info">
                          <span className="vc-applied-code">{appliedVoucher.code}</span>
                          <span className="vc-applied-meta">
                            Giảm {appliedVoucher.discountPercent}% &nbsp;·&nbsp; -{formatCurrency(selectedPackage.price - discountedPrice)}đ
                          </span>
                        </div>
                        <button
                          className="vc-remove-btn"
                          type="button"
                          onClick={handleRemoveVoucher}
                          disabled={payState === 'loading'}
                          aria-label="Xóa mã ưu đãi"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={`vc-input-wrap${voucherError ? ' has-error' : ''}${isCheckingVoucher ? ' is-loading' : ''}`}>
                          <span className="vc-input-icon" aria-hidden="true">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                          </span>
                          <input
                            type="text"
                            value={voucherInput}
                            onChange={(e) => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(''); }}
                            placeholder="Nhập mã ưu đãi"
                            maxLength={20}
                            className="vc-input"
                            disabled={isCheckingVoucher || payState === 'loading'}
                            onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                            autoComplete="off"
                            spellCheck="false"
                          />
                          <button
                            className="vc-apply-btn"
                            type="button"
                            onClick={handleApplyVoucher}
                            disabled={isCheckingVoucher || payState === 'loading'}
                          >
                            {isCheckingVoucher
                              ? <span className="vc-spinner" aria-label="Đang kiểm tra" />
                              : 'Áp dụng'}
                          </button>
                        </div>
                        {voucherError && (
                          <p className="vc-error" role="alert">
                            <span className="vc-error-icon" aria-hidden="true">⚠</span>
                            {voucherError}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="payment-actions">
                    <button
                      className="btn-cancel"
                      onClick={handleCancel}
                      disabled={payState === 'loading'}
                    >
                      Quay lại
                    </button>
                    <button
                      className="btn-pay"
                      onClick={handlePayosPayment}
                      disabled={payState === 'loading'}
                    >
                      {payState === 'loading'
                        ? 'Đang tạo mã QR…'
                        : `Thanh toán ${formatCurrency(discountedPrice)}đ`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
