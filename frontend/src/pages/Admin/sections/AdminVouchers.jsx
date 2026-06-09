import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import adminAPI from "../../../services/adminAPI";

const initialForm = {
  code: "",
  discountPercent: 30,
  maxUses: 1,
  requiresReferralCode: false,
  note: "",
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");

const AdminVouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getVouchers();
      if (res.data.success) setVouchers(res.data.vouchers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.discountPercent) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setCreating(true);
    try {
      const res = await adminAPI.createVoucher(form);
      if (res.data.success) {
        toast.success("Đã tạo voucher");
        setForm(initialForm);
        fetchVouchers();
      } else {
        toast.error(res.data.message || "Lỗi khi tạo voucher");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id) => {
    const res = await adminAPI.toggleVoucher(id);
    if (res.data.success) {
      toast.success("Đã cập nhật trạng thái");
      fetchVouchers();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xác nhận xoá voucher này?")) return;
    const res = await adminAPI.deleteVoucher(id);
    if (res.data.success) {
      toast.success("Đã xoá voucher");
      fetchVouchers();
    }
  };

  const handleReferralOnlyChange = (checked) => {
    setForm((prev) => ({
      ...prev,
      requiresReferralCode: checked,
      maxUses: checked ? 0 : 1,
    }));
  };

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Tạo mã giảm giá mới</h3>
        <form onSubmit={handleCreate} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label className="admin-label">Mã voucher</label>
            <input
              className="admin-input"
              placeholder="VD: GP30-ABCD"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              maxLength={30}
            />
          </div>
          <div>
            <label className="admin-label">Giảm giá (%)</label>
            <input
              className="admin-input"
              type="number"
              min={1}
              max={100}
              value={form.discountPercent}
              onChange={(e) => setForm((f) => ({ ...f, discountPercent: Number(e.target.value) }))}
              style={{ width: 90 }}
            />
          </div>
          <div>
            <label className="admin-label">Số lượt dùng tối đa</label>
            <input
              className="admin-input"
              type="number"
              min={1}
              value={form.maxUses}
              disabled={form.requiresReferralCode}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: Number(e.target.value) }))}
              style={{ width: 90 }}
            />
          </div>
          <label className="admin-label" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={form.requiresReferralCode}
              onChange={(e) => handleReferralOnlyChange(e.target.checked)}
            />
            Chỉ user đã dùng referral code
          </label>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="admin-label">Ghi chú</label>
            <input
              className="admin-input"
              placeholder="Ghi chú (tuỳ chọn)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <button type="submit" className="admin-btn-primary" disabled={creating}>
            {creating ? "Đang tạo..." : "+ Tạo mã"}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h3 style={{ marginBottom: 16 }}>Danh sách mã giảm giá ({vouchers.length})</h3>
        {loading ? (
          <p>Đang tải...</p>
        ) : vouchers.length === 0 ? (
          <p style={{ opacity: 0.6 }}>Chưa có mã nào. Hãy seed hoặc tạo mới.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Giảm (%)</th>
                  <th>Đã dùng / Tối đa</th>
                  <th>Điều kiện</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th>Ngày tạo</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v._id}>
                    <td><strong style={{ fontFamily: "monospace" }}>{v.code}</strong></td>
                    <td>{v.discountPercent}%</td>
                    <td>{v.usedBy?.length || 0} / {Number(v.maxUses) <= 0 ? "Không giới hạn" : v.maxUses}</td>
                    <td>{v.requiresReferralCode ? "Referral users" : "Tất cả"}</td>
                    <td>
                      <span className={`admin-badge ${v.isActive ? "badge-green" : "badge-gray"}`}>
                        {v.isActive ? "Đang hoạt động" : "Đã tắt"}
                      </span>
                    </td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.note || "—"}
                    </td>
                    <td>{formatDate(v.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className={`admin-btn-sm ${v.isActive ? "admin-btn-warning" : "admin-btn-success"}`}
                          onClick={() => handleToggle(v._id)}
                        >
                          {v.isActive ? "Tắt" : "Bật"}
                        </button>
                        <button
                          className="admin-btn-sm admin-btn-danger"
                          onClick={() => handleDelete(v._id)}
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVouchers;
