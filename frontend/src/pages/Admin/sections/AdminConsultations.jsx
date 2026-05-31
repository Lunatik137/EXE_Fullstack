import { useEffect, useState, useCallback } from "react";
import adminAPI from "../../../services/adminAPI";

const AdminConsultations = () => {
  const [consultations, setConsultations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getConsultations({ page, limit: 20, status: statusFilter });
      if (res.data.success) {
        setConsultations(res.data.consultations);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchConsultations(); }, [fetchConsultations]);

  const STATUS_COLORS = { pending: "orange", active: "blue", completed: "green", cancelled: "red" };
  const STATUS_LABELS = { pending: "Chờ duyệt", active: "Đang tư vấn", completed: "Hoàn thành", cancelled: "Đã huỷ" };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">🩺 Quản lý tư vấn</h2>
        <span style={{ fontSize: 13, color: "#64748b" }}>Tổng: {total}</span>
      </div>

      <div className="admin-filters">
        <select className="admin-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="active">Đang tư vấn</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã huỷ</option>
        </select>
      </div>

      <div className="admin-table-wrapper">
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" />Đang tải...</div>
        ) : consultations.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">🩺</div><div className="admin-empty-text">Không có tư vấn</div></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Người dùng</th><th>Bác sĩ</th><th>Trạng thái</th><th>Ngày tạo</th><th>Xem</th></tr>
            </thead>
            <tbody>
              {consultations.map((c) => (
                <tr key={c._id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.userId?.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.userId?.email}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.doctorId?.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.doctorId?.specialization || c.doctorId?.specialty}</div>
                  </td>
                  <td><span className={`admin-badge admin-badge-${STATUS_COLORS[c.status] || "gray"}`}>{STATUS_LABELS[c.status] || c.status}</span></td>
                  <td>{new Date(c.createdAt).toLocaleDateString("vi-VN")}</td>
                  <td>
                    <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setSelected(c)}>Chi tiết</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-pagination">
          <span>Trang {page} / {pages} — {total} tư vấn</span>
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
              <h3 className="admin-modal-title">Chi tiết tư vấn</h3>
              <button className="admin-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                ["ID", selected._id],
                ["Trạng thái", STATUS_LABELS[selected.status] || selected.status],
                ["Người dùng", selected.userId?.name],
                ["Email", selected.userId?.email],
                ["Bác sĩ", selected.doctorId?.name],
                ["Chuyên khoa", selected.doctorId?.specialization || selected.doctorId?.specialty],
                ["Ngày tạo", new Date(selected.createdAt).toLocaleString("vi-VN")],
              ].map(([k, v]) => (
                <div key={k} style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", wordBreak: "break-all" }}>{v}</div>
                </div>
              ))}
            </div>
            {selected.message && (
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Tin nhắn</div>
                {selected.message}
              </div>
            )}
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConsultations;
