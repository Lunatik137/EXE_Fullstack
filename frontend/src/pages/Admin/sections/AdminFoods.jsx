import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import adminAPI from "../../../services/adminAPI";

const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

const CATEGORIES = ["Salad", "Rolls", "Deserts", "Sandwich", "Cake", "Pure Veg", "Pasta", "Noodles"];

const AdminFoods = () => {
  const [foods, setFoods] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "Salad" });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchFoods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getFoods({ page, limit: 20, search, category: categoryFilter });
      if (res.data.success) {
        setFoods(res.data.foods);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  useEffect(() => { fetchFoods(); }, [fetchFoods]);

  const openAdd = () => {
    setForm({ name: "", description: "", price: "", category: "Salad" });
    setImageFile(null);
    setEditItem(null);
    setShowAddModal(true);
  };

  const openEdit = (food) => {
    setForm({ name: food.name, description: food.description, price: food.price, category: food.category });
    setImageFile(null);
    setEditItem(food);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return toast.error("Vui lòng điền đầy đủ thông tin");
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append("image", imageFile);

      let res;
      if (editItem) {
        res = await adminAPI.updateFood(editItem._id, fd);
      } else {
        if (!imageFile) { toast.error("Vui lòng chọn ảnh"); return; }
        res = await adminAPI.addFood(fd);
      }
      if (res.data.success) {
        toast.success(editItem ? "Đã cập nhật" : "Đã thêm món ăn");
        setShowAddModal(false);
        fetchFoods();
      } else {
        toast.error(res.data.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xác nhận xoá món ăn này?")) return;
    const res = await adminAPI.deleteFood(id);
    if (res.data.success) { toast.success("Đã xoá"); fetchFoods(); }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">🍽️ Quản lý món ăn</h2>
        <button className="admin-btn admin-btn-primary" onClick={openAdd}>+ Thêm món ăn</button>
      </div>

      <div className="admin-filters">
        <input className="admin-search-input" placeholder="🔍 Tìm tên món..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="admin-select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả danh mục</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="admin-table-wrapper">
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" />Đang tải...</div>
        ) : foods.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">🍽️</div><div className="admin-empty-text">Không có món ăn</div></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Ảnh</th><th>Tên</th><th>Danh mục</th><th>Giá</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {foods.map((f) => (
                <tr key={f._id}>
                  <td>
                    <img
                      src={`${API_URL}/images/${f.image}`}
                      alt={f.name}
                      style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{f.description?.slice(0, 50)}...</div>
                  </td>
                  <td><span className="admin-badge admin-badge-blue">{f.category}</span></td>
                  <td style={{ fontWeight: 600 }}>{Number(f.price).toLocaleString("vi-VN")}đ</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openEdit(f)}>Sửa</button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(f._id)}>Xoá</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-pagination">
          <span>Trang {page} / {pages} — {total} món</span>
          <div className="admin-pagination-btns">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">{editItem ? "Sửa món ăn" : "Thêm món ăn"}</h3>
              <button className="admin-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Tên món *</label>
              <input className="admin-form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nhập tên món ăn" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Mô tả</label>
              <textarea className="admin-form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả món ăn" />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Giá (VND) *</label>
                <input className="admin-form-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="50000" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Danh mục</label>
                <select className="admin-form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Ảnh {!editItem && "*"}</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} style={{ fontSize: 13 }} />
              {editItem && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Để trống nếu không đổi ảnh</div>}
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => setShowAddModal(false)}>Huỷ</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Đang lưu..." : editItem ? "Cập nhật" : "Thêm mới"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFoods;
