import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import adminAPI from "../../../services/adminAPI";

const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const avatarSrc = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith("http")) return avatar;
  return `${API_URL}/uploads/${avatar}`;
};

const postImgSrc = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_URL}/uploads/posts/${url}`;
};

const AdminPosts = () => {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getPosts({ page, limit: 20, search, type: typeFilter });
      if (res.data.success) {
        setPosts(res.data.posts);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleDelete = async (id) => {
    if (!window.confirm("Xác nhận xoá bài đăng này?")) return;
    const res = await adminAPI.deletePost(id);
    if (res.data.success) {
      toast.success("Đã xoá bài đăng");
      fetchPosts();
      setSelected(null);
    }
  };

  const TYPE_COLORS = { normal: "blue", recipe: "green", "nutrition-qa": "purple", review: "orange" };
  const TYPE_LABELS = { normal: "Bình thường", recipe: "Công thức", "nutrition-qa": "Dinh dưỡng", review: "Review" };

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">💬 Quản lý bài đăng</h2>
        <span style={{ fontSize: 13, color: "#64748b" }}>Tổng: {total}</span>
      </div>

      <div className="admin-filters">
        <input className="admin-search-input" placeholder="🔍 Tìm nội dung..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="admin-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả loại</option>
          <option value="normal">Bình thường</option>
          <option value="recipe">Công thức</option>
          <option value="nutrition-qa">Dinh dưỡng</option>
          <option value="review">Review</option>
        </select>
      </div>

      <div className="admin-table-wrapper">
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" />Đang tải...</div>
        ) : posts.length === 0 ? (
          <div className="admin-empty"><div className="admin-empty-icon">💬</div><div className="admin-empty-text">Không có bài đăng</div></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Tác giả</th><th>Nội dung</th><th>Loại</th><th>Ngày đăng</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {avatarSrc(p.userId?.avatar) ? (
                        <img src={avatarSrc(p.userId.avatar)} alt="" className="admin-avatar" onError={(e) => { e.target.style.display = "none"; }} />
                      ) : (
                        <div className="admin-avatar-placeholder">{p.userId?.name?.[0]?.toUpperCase()}</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{p.userId?.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.userId?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.content}
                    </div>
                    {p.hashtags?.length > 0 && (
                      <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 2 }}>
                        {p.hashtags.map(h => `#${h}`).join(" ")}
                      </div>
                    )}
                  </td>
                  <td><span className={`admin-badge admin-badge-${TYPE_COLORS[p.type] || "gray"}`}>{TYPE_LABELS[p.type] || p.type}</span></td>
                  <td>{new Date(p.createdAt).toLocaleDateString("vi-VN")}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setSelected(p)}>Xem</button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(p._id)}>Xoá</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-pagination">
          <span>Trang {page} / {pages} — {total} bài</span>
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
              <h3 className="admin-modal-title">Chi tiết bài đăng</h3>
              <button className="admin-modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              {avatarSrc(selected.userId?.avatar) ? (
                <img src={avatarSrc(selected.userId.avatar)} alt="" className="admin-avatar" onError={(e) => { e.target.style.display = "none"; }} />
              ) : (
                <div className="admin-avatar-placeholder">{selected.userId?.name?.[0]?.toUpperCase()}</div>
              )}
              <div>
                <div style={{ fontWeight: 600 }}>{selected.userId?.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{new Date(selected.createdAt).toLocaleString("vi-VN")}</div>
              </div>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
              {selected.content}
            </div>
            {selected.media?.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {selected.media.filter(m => m.type === "image").map((m, i) => (
                  <img key={i} src={postImgSrc(m.url)} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6 }} onError={(e) => { e.target.style.display = "none"; }} />
                ))}
              </div>
            )}
            {selected.hashtags?.length > 0 && (
              <div style={{ fontSize: 13, color: "#38bdf8", marginBottom: 16 }}>
                {selected.hashtags.map(h => `#${h}`).join(" ")}
              </div>
            )}
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(selected._id)}>Xoá bài</button>
              <button className="admin-btn admin-btn-outline" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPosts;
