import { useState, useContext, useEffect } from "react";
import { Route, Routes, useNavigate, useLocation } from "react-router-dom";
import Home from "./pages/Home/Home";
import RecipeLibrary from "./pages/RecipeLibrary/RecipeLibrary";
import Profile from "./pages/Profile/Profile";
import Community from "./pages/Community/Community";
import LoginPopup from "./components/LoginPopup/LoginPopup";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import Welcome from "./pages/Welcome/Welcome";
import Onboarding from "./pages/Onboarding/Onboarding";
import PlanSelection from "./pages/PlanSelection/PlanSelection";
import MealPlanPreview from "./pages/MealPlanPreview/MealPlanPreview";
import { StoreContext } from "./context/StoreContext";
import "./App.css";

const App = () => {
  const { showLogin, setShowLogin, token, hasCompletedOnboarding } = useContext(StoreContext);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect logic based on authentication and onboarding status
  useEffect(() => {
    if (!token && location.pathname !== '/welcome') {
      navigate('/welcome');
    } else if (token && location.pathname === '/welcome') {
      // If logged in but on welcome page, check onboarding status
      if (!hasCompletedOnboarding) {
        navigate('/onboarding');
      } else {
        navigate('/');
      }
    } else if (token && !hasCompletedOnboarding && location.pathname !== '/onboarding') {
      // If logged in but haven't completed onboarding, redirect to onboarding
      navigate('/onboarding');
    } else if (token && hasCompletedOnboarding && location.pathname === '/onboarding') {
      // If already completed onboarding, don't allow access to onboarding page
      navigate('/');
    }
  }, [token, hasCompletedOnboarding, location.pathname, navigate]);

  // Show welcome page for non-authenticated users
  if (!token) {
    return (
      <>
        {showLogin.show ? (
          <LoginPopup 
            setShowLogin={setShowLogin} 
            initialMode={showLogin.mode} 
          />
        ) : null}
        <div className="app-welcome">
          <ToastContainer />
          <Routes>
            <Route path="/welcome" element={<Welcome />} />
            <Route path="*" element={<Welcome />} />
          </Routes>
        </div>
      </>
    );
  }

  // Show onboarding and plan selection pages without sidebar/header
  if (location.pathname === '/onboarding' || location.pathname === '/plan-selection' || location.pathname === '/generate-plan') {
    return (
      <div className="app-welcome">
        <ToastContainer />
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/plan-selection" element={<PlanSelection />} />
          <Route path="/generate-plan" element={<MealPlanPreview />} />
        </Routes>
      </div>
    );
  }
  
  return (
    <>
      {showLogin.show ? (
        <LoginPopup 
          setShowLogin={setShowLogin} 
          initialMode={showLogin.mode} 
        />
      ) : null}
      <div className="app">
        <ToastContainer />
        <Sidebar isCollapsed={sidebarCollapsed} setIsCollapsed={setSidebarCollapsed} />
        <div className={`dashboard-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Header />
          <div className="dashboard-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/recipes" element={<RecipeLibrary />} />
              <Route path="/recipes/:id" element={<RecipeLibrary />} />
              <Route path="/community" element={<Community />} />
              <Route path="/myprofile" element={<Profile />} />
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
