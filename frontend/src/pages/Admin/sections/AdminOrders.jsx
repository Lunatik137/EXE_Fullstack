import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import adminAPI from "../../../services/adminAPI";

const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

const STATUS_COLORS = {
  "Food Processing": "orange",
  "Out for Delivery": "blue",
  Delivered: "green",
  Cancelled: "red",
};

const STATUSES = ["Food Processing", "Out for Delivery", "Delivered", "Cancelled"];

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getOrders({
        page,
        limit: 20,
        status: statusFilter,
        payment: paymentFilter,
      });
      if (res.data.success) {
        setOrders(res.data.orders);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, paymentFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStatusChange = async (orderId, status) => {
    const res = await adminAPI.updateOrderStatus(orderId, status);
    if (res.data.success) {
      toast.success("Đã cập nhật trạng thái");
      fetchOrders();
      if (selected?._id === orderId) setSelected({ ...selected, status });
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">🛒 Quản lý đơn hàng</h2>
        <span style={{ fontSize: 13, color: "#64748b" }}>Tổng: {total}</span>
      </div>

      <div className="admin-filters">
        <select className="admin-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="admin-select" value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả thanh toán</option>
          <option value="true">Đã thanh toán</option>
          <option value="false">Chưa thanh toán</option>
        </select>
      </div>

      <div className="admin-table-wrapper">
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" />Đang tải...</div>
        ) : orders.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">🛒</div><div className="admin-empty-text">Không có đơn hàng</div></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Ngày</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>#{o._id.slice(-8).toUpperCase()}</td>
                  <td style={{ fontWeight: 600 }}>{o.amount?.toLocaleString("vi-VN")}đ</td>
                  <td>
                    <span className={`admin-badge admin-badge-${STATUS_COLORS[o.status] || "gray"}`}>{o.status}</span>
                  </td>
                  <td>
                    <span className={`admin-badge ${o.payment ? "admin-badge-green" : "admin-badge-red"}`}>
                      {o.payment ? "✓ Đã TT" : "✗ Chưa TT"}
                    </span>
                  </td>
                  <td>{new Date(o.date).toLocaleDateString("vi-VN")}</td>
                  <td>
                    <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setSelected(o)}>Chi tiết</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-pagination">
          <span>Trang {page} / {pages} — {total} đơn hàng</span>
          <div className="admin-pagination-btns">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="admin-modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Chi tiết đơn hàng</h3>
              <button className="admin-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Mã đơn</div>
              <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{selected._id}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Địa chỉ</div>
              {selected.address && (
                <div style={{ fontSize: 13, color: "#334155" }}>
                  {selected.address.firstName} {selected.address.lastName}<br />
                  {selected.address.street}, {selected.address.city}<br />
                  {selected.address.phone}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Sản phẩm</div>
              {selected.items?.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span>{item.name} × {item.quantity}</span>
                  <span style={{ fontWeight: 500 }}>{(item.price * item.quantity).toLocaleString("vi-VN")}đ</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                <span>Tổng</span>
                <span style={{ color: "#0ea5e9" }}>{selected.amount?.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Cập nhật trạng thái</label>
              <select
                className="admin-form-select"
                value={selected.status}
                onChange={(e) => handleStatusChange(selected._id, e.target.value)}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
