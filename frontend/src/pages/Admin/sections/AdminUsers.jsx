import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import adminAPI from "../../../services/adminAPI";

const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const PLAN_LABELS = { free: ["gray", "Free"], premium: ["green", "Premium"] };
const ROLE_LABELS = { admin: ["purple", "Admin"], user: ["blue", "User"] };

const PACKAGES = [
  { value: "premium-1-month",  label: "Premium 1 tháng",  days: 30 },
  { value: "premium-3-month",  label: "Premium 3 tháng",  days: 90 },
  { value: "premium-12-month", label: "Premium 1 năm",    days: 365 },
  { value: "premium-couple",   label: "Gói Couple",       days: 30 },
];

const getEndDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const avatarSrc = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith("http")) return avatar;
  return `${API_URL}/uploads/${avatar}`;
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [planForm, setPlanForm] = useState({ planType: "free", pkg: "", endDate: "" });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getUsers({ page, limit: 20, search, role: roleFilter, planType: planFilter });
      if (res.data.success) {
        setUsers(res.data.users);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, planFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  const openDetail = async (user) => {
    setSelected(user);
    setPlanForm({
      planType: user.planType || "free",
      pkg: user.premiumPackage || "",
      endDate: user.subscriptionEndDate ? new Date(user.subscriptionEndDate).toISOString().slice(0, 10) : "",
    });
    setShowModal(true);
  };

  const handleRoleChange = async (userId, newRole) => {
    const res = await adminAPI.updateUserRole(userId, newRole);
    if (res.data.success) {
      toast.success("Đã cập nhật role");
      fetchUsers();
      if (selected?._id === userId) setSelected({ ...selected, role: newRole });
    }
  };

  const handlePlanChange = async (userId) => {
    const payload = { planType: planForm.planType };
    if (planForm.planType === "premium") {
      if (planForm.pkg) payload.premiumPackage = planForm.pkg;
      if (planForm.endDate) payload.subscriptionEndDate = planForm.endDate;
    }
    const res = await adminAPI.updateUserPlan(userId, payload);
    if (res.data.success) {
      toast.success("Đã cập nhật gói");
      fetchUsers();
      setSelected((prev) => prev ? { ...prev, ...payload } : prev);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Xác nhận xoá người dùng này?")) return;
    const res = await adminAPI.deleteUser(userId);
    if (res.data.success) {
      toast.success("Đã xoá người dùng");
      fetchUsers();
      setShowModal(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">👥 Quản lý người dùng</h2>
        <span style={{ fontSize: 13, color: "#64748b" }}>Tổng: {total}</span>
      </div>

      <div className="admin-filters">
        <input
          className="admin-search-input"
          placeholder="🔍 Tìm tên hoặc email..."
          value={search}
          onChange={handleSearch}
        />
        <select className="admin-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả Role</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select className="admin-select" value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả Plan</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      <div className="admin-table-wrapper">
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" />Đang tải...</div>
        ) : users.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">👥</div><div className="admin-empty-text">Không có người dùng</div></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Email</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Ngày tạo</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const [rc, rl] = ROLE_LABELS[u.role] || ["gray", u.role];
                const [pc, pl] = PLAN_LABELS[u.planType] || ["gray", u.planType];
                return (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {avatarSrc(u.avatar) ? (
                          <img src={avatarSrc(u.avatar)} alt="" className="admin-avatar" onError={(e) => { e.target.style.display = "none"; }} />
                        ) : (
                          <div className="admin-avatar-placeholder">{u.name?.[0]?.toUpperCase()}</div>
                        )}
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className={`admin-badge admin-badge-${rc}`}>{rl}</span></td>
                    <td><span className={`admin-badge admin-badge-${pc}`}>{pl}</span></td>
                    <td>{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openDetail(u)}>Chi tiết</button>
                        <button
                          className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => handleDelete(u._id)}
                        >Xoá</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="admin-pagination">
          <span>Trang {page} / {pages} — {total} người dùng</span>
          <div className="admin-pagination-btns">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {showModal && selected && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Chi tiết người dùng</h3>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              {avatarSrc(selected.avatar) ? (
                <img src={avatarSrc(selected.avatar)} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
              ) : (
                <div className="admin-avatar-placeholder" style={{ width: 56, height: 56, fontSize: 20 }}>
                  {selected.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{selected.email}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                ["ID", selected._id],
                ["Role", selected.role],
                ["Plan", selected.planType],
                ["Status", selected.subscriptionStatus],
                ["Onboarding", selected.hasCompletedOnboarding ? "Hoàn tất" : "Chưa"],
                ["Ngày tạo", new Date(selected.createdAt).toLocaleDateString("vi-VN")],
                ["Hết hạn Premium", selected.subscriptionEndDate ? new Date(selected.subscriptionEndDate).toLocaleDateString("vi-VN") : "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", wordBreak: "break-all" }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="admin-form-row" style={{ marginBottom: 16 }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Đổi Role</label>
                <select
                  className="admin-form-select"
                  defaultValue={selected.role}
                  onChange={(e) => handleRoleChange(selected._id, e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Loại Plan</label>
                <select
                  className="admin-form-select"
                  value={planForm.planType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setPlanForm((f) => ({ ...f, planType: t, pkg: t === "premium" ? f.pkg || "premium-1-month" : "", endDate: t === "premium" ? getEndDate(30) : "" }));
                  }}
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>
            {planForm.planType === "premium" && (
              <div className="admin-form-row" style={{ marginBottom: 16 }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Gói Premium</label>
                  <select
                    className="admin-form-select"
                    value={planForm.pkg}
                    onChange={(e) => {
                      const pkg = PACKAGES.find((p) => p.value === e.target.value);
                      setPlanForm((f) => ({ ...f, pkg: e.target.value, endDate: pkg ? getEndDate(pkg.days) : f.endDate }));
                    }}
                  >
                    <option value="">-- Chọn gói --</option>
                    {PACKAGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Hết hạn</label>
                  <input
                    className="admin-form-input"
                    type="date"
                    value={planForm.endDate}
                    onChange={(e) => setPlanForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handlePlanChange(selected._id)}>
                💾 Lưu thay đổi Plan
              </button>
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(selected._id)}>
                🗑️ Xoá người dùng
              </button>
              <button className="admin-btn admin-btn-outline" onClick={() => setShowModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
