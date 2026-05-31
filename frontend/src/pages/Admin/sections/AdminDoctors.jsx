import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import adminAPI from "../../../services/adminAPI";

const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

const EMPTY_DOCTOR = {
  name: "", title: "", specialty: "", bio: "", detail: "",
  positions: "", education: "", experience: "", expertise: "", workplaces: "",
  order: 0,
};

const AdminDoctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_DOCTOR);
  const [addImage, setAddImage] = useState(null);
  const [adding, setAdding] = useState(false);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getDoctors({ page, limit: 20, search });
      if (res.data.success) {
        setDoctors(res.data.doctors);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const handleDelete = async (id) => {
    if (!window.confirm("Xác nhận xoá bác sĩ này?")) return;
    const res = await adminAPI.deleteDoctor(id);
    if (res.data.success) { toast.success("Đã xoá"); fetchDoctors(); }
  };

  const handleToggleActive = async (doctor) => {
    const res = await adminAPI.updateDoctor(doctor._id, { isActive: !doctor.isActive });
    if (res.data.success) { toast.success("Đã cập nhật"); fetchDoctors(); }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await adminAPI.updateDoctor(editItem._id, editItem);
      if (res.data.success) {
        toast.success("Đã cập nhật bác sĩ");
        setEditItem(null);
        fetchDoctors();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddDoctor = async () => {
    if (!addImage) return toast.error("Vui lòng chọn ảnh bác sĩ");
    if (!addForm.name || !addForm.title || !addForm.specialty) return toast.error("Điền đầy đủ Tên, Chức danh, Chuyên khoa");
    setAdding(true);
    try {
      const fd = new FormData();
      Object.entries(addForm).forEach(([k, v]) => { if (v !== "") fd.append(k, v); });
      fd.append("image", addImage);
      const res = await adminAPI.addDoctor(fd);
      if (res.data.success) {
        toast.success("Đã thêm bác sĩ mới");
        setShowAdd(false);
        setAddForm(EMPTY_DOCTOR);
        setAddImage(null);
        fetchDoctors();
      } else {
        toast.error(res.data.message || "Lỗi thêm bác sĩ");
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">👨‍⚕️ Quản lý bác sĩ</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Tổng: {total}</span>
          <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setShowAdd(true)}>
            + Thêm bác sĩ
          </button>
        </div>
      </div>

      <div className="admin-filters">
        <input className="admin-search-input" placeholder="🔍 Tìm tên hoặc chuyên khoa..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div className="admin-table-wrapper">
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" />Đang tải...</div>
        ) : doctors.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">👨‍⚕️</div><div className="admin-empty-text">Không có bác sĩ</div></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Bác sĩ</th><th>Chức danh</th><th>Chuyên khoa</th><th>Trạng thái</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img
                        src={`${API_URL}/uploads/doctors/${d.image}`}
                        alt={d.name}
                        style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.bio?.slice(0, 40)}{d.bio?.length > 40 ? "..." : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td>{d.title}</td>
                  <td><span className="admin-badge admin-badge-blue">{d.specialty}</span></td>
                  <td>
                    <span className={`admin-badge ${d.isActive ? "admin-badge-green" : "admin-badge-red"}`}>
                      {d.isActive ? "Hoạt động" : "Tạm dừng"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setEditItem({ ...d })}>Sửa</button>
                      <button
                        className={`admin-btn admin-btn-sm ${d.isActive ? "admin-btn-outline" : "admin-btn-success"}`}
                        onClick={() => handleToggleActive(d)}
                      >{d.isActive ? "Ẩn" : "Hiện"}</button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(d._id)}>Xoá</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-pagination">
          <span>Trang {page} / {pages} — {total} bác sĩ</span>
          <div className="admin-pagination-btns">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* ── Add Doctor Modal ── */}
      {showAdd && (
        <div className="admin-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="admin-modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Thêm bác sĩ mới</h3>
              <button className="admin-modal-close" onClick={() => setShowAdd(false)}>×</button>
            </div>

            {/* Image upload */}
            <div className="admin-form-group">
              <label className="admin-form-label">Ảnh bác sĩ <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {addImage ? (
                  <img src={URL.createObjectURL(addImage)} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>
                )}
                <label className="admin-btn admin-btn-outline admin-btn-sm" style={{ cursor: "pointer" }}>
                  📷 Chọn ảnh
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setAddImage(e.target.files[0] || null)} />
                </label>
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Tên đầy đủ <span style={{ color: "#ef4444" }}>*</span></label>
                <input className="admin-form-input" placeholder="VD: Nguyễn Văn A" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Chức danh <span style={{ color: "#ef4444" }}>*</span></label>
                <input className="admin-form-input" placeholder="VD: Bác Sĩ, ThS.BS, BS.CKI" value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Chuyên khoa <span style={{ color: "#ef4444" }}>*</span></label>
                <input className="admin-form-input" placeholder="VD: Khoa Nội Tiết" value={addForm.specialty} onChange={(e) => setAddForm({ ...addForm, specialty: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Thứ tự hiển thị</label>
                <input className="admin-form-input" type="number" value={addForm.order} onChange={(e) => setAddForm({ ...addForm, order: e.target.value })} />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Giới thiệu ngắn</label>
              <textarea className="admin-form-textarea" rows={2} placeholder="Mô tả ngắn về bác sĩ..." value={addForm.bio} onChange={(e) => setAddForm({ ...addForm, bio: e.target.value })} />
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Chức vụ <span style={{ fontSize: 10, color: "#94a3b8" }}>(mỗi dòng một chức vụ)</span></label>
                <textarea className="admin-form-textarea" rows={2} placeholder="VD: Trưởng khoa Dinh dưỡng" value={addForm.positions} onChange={(e) => setAddForm({ ...addForm, positions: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Nơi công tác <span style={{ fontSize: 10, color: "#94a3b8" }}>(mỗi dòng)</span></label>
                <textarea className="admin-form-textarea" rows={2} placeholder="VD: Bệnh viện Bạch Mai" value={addForm.workplaces} onChange={(e) => setAddForm({ ...addForm, workplaces: e.target.value })} />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Học vị <span style={{ fontSize: 10, color: "#94a3b8" }}>(mỗi dòng)</span></label>
                <textarea className="admin-form-textarea" rows={2} placeholder="VD: Bác sĩ đa khoa - ĐH Y Hà Nội" value={addForm.education} onChange={(e) => setAddForm({ ...addForm, education: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Chuyên môn <span style={{ fontSize: 10, color: "#94a3b8" }}>(mỗi dòng)</span></label>
                <textarea className="admin-form-textarea" rows={2} placeholder="VD: Tiểu đường, Béo phì" value={addForm.expertise} onChange={(e) => setAddForm({ ...addForm, expertise: e.target.value })} />
              </div>
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => { setShowAdd(false); setAddForm(EMPTY_DOCTOR); setAddImage(null); }}>Huỷ</button>
              <button className="admin-btn admin-btn-primary" onClick={handleAddDoctor} disabled={adding}>
                {adding ? "Đang lưu..." : "➕ Thêm bác sĩ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Doctor Modal ── */}
      {editItem && (
        <div className="admin-modal-overlay" onClick={() => setEditItem(null)}>
          <div className="admin-modal" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Sửa thông tin bác sĩ</h3>
              <button className="admin-modal-close" onClick={() => setEditItem(null)}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <img src={`${API_URL}/uploads/doctors/${editItem.image}`} alt=""
                style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Để thay ảnh, xoá và tạo lại bác sĩ với ảnh mới</span>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Tên</label>
                <input className="admin-form-input" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Chức danh</label>
                <input className="admin-form-input" value={editItem.title} onChange={(e) => setEditItem({ ...editItem, title: e.target.value })} />
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Chuyên khoa</label>
              <input className="admin-form-input" value={editItem.specialty} onChange={(e) => setEditItem({ ...editItem, specialty: e.target.value })} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Giới thiệu ngắn</label>
              <textarea className="admin-form-textarea" value={editItem.bio} onChange={(e) => setEditItem({ ...editItem, bio: e.target.value })} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Thứ tự hiển thị</label>
              <input className="admin-form-input" type="number" value={editItem.order} onChange={(e) => setEditItem({ ...editItem, order: Number(e.target.value) })} />
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => setEditItem(null)}>Huỷ</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Đang lưu..." : "Cập nhật"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDoctors;
