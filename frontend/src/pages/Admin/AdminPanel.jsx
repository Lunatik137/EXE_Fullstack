import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "./Admin.css";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./sections/AdminDashboard";
import AdminUsers from "./sections/AdminUsers";
import AdminPosts from "./sections/AdminPosts";
import AdminRecipes from "./sections/AdminRecipes";
import AdminDoctors from "./sections/AdminDoctors";
import AdminConsultations from "./sections/AdminConsultations";
import AdminVouchers from "./sections/AdminVouchers";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "📊", section: "Tổng quan" },
  { key: "users", label: "Người dùng", icon: "👥", section: "Quản lý" },
  { key: "vouchers", label: "Voucher", icon: "🏷️", section: "Quản lý" },
  { key: "recipes", label: "Công thức", icon: "📖", section: "Nội dung" },
  { key: "posts", label: "Bài đăng", icon: "💬", section: "Nội dung" },
  { key: "doctors", label: "Bác sĩ", icon: "👨‍⚕️", section: "Y tế" },
  { key: "consultations", label: "Tư vấn", icon: "🩺", section: "Y tế" },
];

const PAGE_TITLES = {
  dashboard: "Dashboard",
  users: "Quản lý người dùng",
  vouchers: "Quản lý Voucher",
  recipes: "Quản lý công thức",
  posts: "Quản lý bài đăng",
  doctors: "Quản lý bác sĩ",
  consultations: "Quản lý tư vấn",
};

const renderSection = (active) => {
  switch (active) {
    case "dashboard":      return <AdminDashboard />;
    case "users":          return <AdminUsers />;
    case "vouchers":       return <AdminVouchers />;
    case "recipes":        return <AdminRecipes />;
    case "posts":          return <AdminPosts />;
    case "doctors":        return <AdminDoctors />;
    case "consultations":  return <AdminConsultations />;
    default:               return <AdminDashboard />;
  }
};

const AdminPanel = () => {
  const [token, setToken] = useState(() => localStorage.getItem("adminToken") || "");
  const [active, setActive] = useState("dashboard");

  // Validate token still has admin access
  useEffect(() => {
    if (!token) return;
    // Quick sanity: if a normal token was reused, backend will reject with 'Admin access required'
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setToken("");
    toast.info("Đã đăng xuất");
  };

  if (!token) {
    return <AdminLogin onLogin={(t) => setToken(t)} />;
  }

  // Group nav items by section
  const sections = [...new Set(NAV_ITEMS.map((i) => i.section))];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div>
            <div className="admin-sidebar-logo"><img src="/logo.png" alt="GreenPath" className="admin-logo-img" /> GreenPath</div>
            <div className="admin-sidebar-subtitle">Admin Panel</div>
          </div>
        </div>

        <nav className="admin-nav">
          {sections.map((section) => (
            <div key={section}>
              <div className="admin-nav-section">{section}</div>
              {NAV_ITEMS.filter((i) => i.section === section).map((item) => (
                <button
                  key={item.key}
                  className={`admin-nav-item ${active === item.key ? "active" : ""}`}
                  onClick={() => setActive(item.key)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" onClick={handleLogout}>
            <span>🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-title">{PAGE_TITLES[active]}</div>
          <div className="admin-topbar-right">
            <div className="admin-user-badge">
              <div className="admin-user-avatar">A</div>
              <span>Admin</span>
            </div>
          </div>
        </header>

        <main className="admin-content">
          {renderSection(active)}
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
