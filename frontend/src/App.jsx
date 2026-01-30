import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home/Home";
import Cart from "./pages/Cart/Cart";
import PlaceOrder from "./pages/PlaceOrder/PlaceOrder";
import LoginPopup from "./components/LoginPopup/LoginPopup";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Verify from "./pages/Verify/Verify";
import MyOrders from "./pages/MyOrders/MyOrders";
import Community from "./pages/Community/Community";
import RecipeLibrary from "./pages/RecipeLibrary/RecipeLibrary";
import Premium from "./pages/Premium/Premium";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import "./App.css";

const App = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  return (
    <>
      {showLogin ? <LoginPopup setShowLogin={setShowLogin} /> : <></>}
      <div className="app">
        <ToastContainer />
        <Sidebar isCollapsed={sidebarCollapsed} setIsCollapsed={setSidebarCollapsed} />
        <div className={`dashboard-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Header setShowLogin={setShowLogin} />
          <div className="dashboard-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/recipes" element={<RecipeLibrary />} />
              <Route path="/community" element={<Community />} />
              <Route path="/premium" element={<Premium />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/order" element={<PlaceOrder />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/myorders" element={<MyOrders />} />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
