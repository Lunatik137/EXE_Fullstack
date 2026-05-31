import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import adminAPI from "../../../services/adminAPI";

const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const recipeSrc = (img) => img ? `${API_URL}/uploads/recipes/${img}` : null;

const AdminRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getRecipes({ page, limit: 20, search, category: categoryFilter });
      if (res.data.success) {
        setRecipes(res.data.recipes);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const handleDelete = async (id) => {
    if (!window.confirm("Xác nhận xoá công thức này?")) return;
    const res = await adminAPI.deleteRecipe(id);
    if (res.data.success) { toast.success("Đã xoá"); fetchRecipes(); }
  };

  const handleToggleFree = async (recipe) => {
    const res = await adminAPI.updateRecipe(recipe._id, { isFree: !recipe.isFree });
    if (res.data.success) { toast.success("Đã cập nhật"); fetchRecipes(); }
  };

  const handleTogglePopular = async (recipe) => {
    const res = await adminAPI.updateRecipe(recipe._id, { isPopular: !recipe.isPopular });
    if (res.data.success) { toast.success("Đã cập nhật"); fetchRecipes(); }
  };

  const openEdit = (r) => { setEditItem({ ...r }); setEditImageFile(null); };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      let res;
      if (editImageFile) {
        const fd = new FormData();
        Object.entries(editItem).forEach(([k, v]) => {
          if (v != null && k !== "_id" && k !== "__v" && !Array.isArray(v)) fd.append(k, v);
        });
        if (Array.isArray(editItem.ingredients)) fd.append("ingredients", JSON.stringify(editItem.ingredients));
        if (Array.isArray(editItem.instructions)) fd.append("instructions", JSON.stringify(editItem.instructions));
        fd.append("image", editImageFile);
        res = await adminAPI.updateRecipe(editItem._id, fd);
      } else {
        res = await adminAPI.updateRecipe(editItem._id, editItem);
      }
      if (res.data.success) {
        toast.success("Đã cập nhật công thức");
        setEditItem(null);
        setEditImageFile(null);
        fetchRecipes();
      }
    } finally {
      setSaving(false);
    }
  };

  const DIFF_COLORS = { easy: "green", medium: "yellow", hard: "red" };
  const DIFF_LABELS = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };
  const CAT_LABELS = { breakfast: "Sáng", lunch: "Trưa", dinner: "Tối", snack: "Phụ" };
  const CAT_COLORS = { breakfast: "orange", lunch: "blue", dinner: "purple", snack: "cyan" };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">📖 Quản lý công thức</h2>
        <span style={{ fontSize: 13, color: "#64748b" }}>Tổng: {total}</span>
      </div>

      <div className="admin-filters">
        <input className="admin-search-input" placeholder="🔍 Tìm tên công thức..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="admin-select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả danh mục</option>
          <option value="breakfast">Bữa sáng</option>
          <option value="lunch">Bữa trưa</option>
          <option value="dinner">Bữa tối</option>
          <option value="snack">Bữa phụ</option>
        </select>
      </div>

      <div className="admin-table-wrapper">
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" />Đang tải...</div>
        ) : recipes.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">📖</div><div className="admin-empty-text">Không có công thức</div></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Ảnh</th><th>Tên</th><th>Calo</th><th>Độ khó</th><th>Free</th><th>Nổi bật</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r._id}>
                  <td>
                    {r.image ? (
                      <img src={recipeSrc(r.image)} alt={r.name}
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🍽️</div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      <span className={`admin-badge admin-badge-${CAT_COLORS[r.category] || "gray"}`} style={{ fontSize: 10 }}>{CAT_LABELS[r.category] || r.category}</span>
                    </div>
                  </td>
                  <td>{r.calories} kcal</td>
                  <td><span className={`admin-badge admin-badge-${DIFF_COLORS[r.difficulty] || "gray"}`}>{DIFF_LABELS[r.difficulty] || r.difficulty}</span></td>
                  <td>
                    <button
                      className={`admin-btn admin-btn-sm ${r.isFree ? "admin-btn-success" : "admin-btn-outline"}`}
                      onClick={() => handleToggleFree(r)}
                    >{r.isFree ? "✓ Free" : "Lock"}</button>
                  </td>
                  <td>
                    <button
                      className={`admin-btn admin-btn-sm ${r.isPopular ? "admin-btn-primary" : "admin-btn-outline"}`}
                      onClick={() => handleTogglePopular(r)}
                    >{r.isPopular ? "⭐ Hot" : "—"}</button>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setViewItem(r)}>Xem</button>
                      <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openEdit(r)}>Sửa</button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(r._id)}>Xoá</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-pagination">
          <span>Trang {page} / {pages} — {total} công thức</span>
          <div className="admin-pagination-btns">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      </div>

      {/* ── View Modal ── */}
      {viewItem && (
        <div className="admin-modal-overlay" onClick={() => setViewItem(null)}>
          <div className="admin-modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Chi tiết công thức</h3>
              <button className="admin-modal-close" onClick={() => setViewItem(null)}>×</button>
            </div>
            {viewItem.image && (
              <img src={recipeSrc(viewItem.image)} alt={viewItem.name}
                style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 10, marginBottom: 16 }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            )}
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{viewItem.name}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>{viewItem.description}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
              {[["🔥 Calo", `${viewItem.calories} kcal`], ["🥩 Protein", `${viewItem.protein}g`], ["🌾 Carbs", `${viewItem.carbs}g`], ["🧈 Fat", `${viewItem.fat}g`]].map(([label, val]) => (
                <div key={label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[["Danh mục", CAT_LABELS[viewItem.category] || viewItem.category], ["Độ khó", DIFF_LABELS[viewItem.difficulty] || viewItem.difficulty], ["Chuẩn bị", `${viewItem.preparationTime} phút`], ["Nấu", `${viewItem.cookingTime} phút`], ["Khẩu phần", `${viewItem.servings} người`], ["Chế độ ăn", viewItem.dietType]].map(([k, v]) => (
                <div key={k} style={{ background: "#f8fafc", borderRadius: 6, padding: "6px 10px" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{k}: </span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            {viewItem.ingredients?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Nguyên liệu</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#475569" }}>
                  {viewItem.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
              </div>
            )}
            {viewItem.instructions?.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Hướng dẫn</div>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#475569" }}>
                  {viewItem.instructions.map((step, i) => <li key={i} style={{ marginBottom: 4 }}>{step}</li>)}
                </ol>
              </div>
            )}
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => { setViewItem(null); openEdit(viewItem); }}>✏️ Sửa</button>
              <button className="admin-btn admin-btn-outline" onClick={() => setViewItem(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editItem && (
        <div className="admin-modal-overlay" onClick={() => setEditItem(null)}>
          <div className="admin-modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Sửa công thức</h3>
              <button className="admin-modal-close" onClick={() => setEditItem(null)}>×</button>
            </div>

            {/* Image */}
            <div className="admin-form-group">
              <label className="admin-form-label">Ảnh công thức</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                {(editImageFile || editItem.image) && (
                  <img
                    src={editImageFile ? URL.createObjectURL(editImageFile) : recipeSrc(editItem.image)}
                    alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover" }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
                <label className="admin-btn admin-btn-outline admin-btn-sm" style={{ cursor: "pointer" }}>
                  📷 Chọn ảnh mới
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setEditImageFile(e.target.files[0] || null)} />
                </label>
                {editImageFile && <span style={{ fontSize: 12, color: "#64748b" }}>{editImageFile.name}</span>}
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Tên công thức</label>
              <input className="admin-form-input" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Mô tả</label>
              <textarea className="admin-form-textarea" value={editItem.description} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })} />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Calo</label>
                <input className="admin-form-input" type="number" value={editItem.calories} onChange={(e) => setEditItem({ ...editItem, calories: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Protein (g)</label>
                <input className="admin-form-input" type="number" value={editItem.protein} onChange={(e) => setEditItem({ ...editItem, protein: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Carbs (g)</label>
                <input className="admin-form-input" type="number" value={editItem.carbs} onChange={(e) => setEditItem({ ...editItem, carbs: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Fat (g)</label>
                <input className="admin-form-input" type="number" value={editItem.fat} onChange={(e) => setEditItem({ ...editItem, fat: e.target.value })} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Danh mục</label>
                <select className="admin-form-select" value={editItem.category} onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}>
                  <option value="breakfast">Bữa sáng</option>
                  <option value="lunch">Bữa trưa</option>
                  <option value="dinner">Bữa tối</option>
                  <option value="snack">Bữa phụ</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Độ khó</label>
                <select className="admin-form-select" value={editItem.difficulty} onChange={(e) => setEditItem({ ...editItem, difficulty: e.target.value })}>
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
              </div>
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

export default AdminRecipes;
