import { useState, useContext, useEffect } from "react";
import { Route, Routes, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import Home from "./pages/Home/Home";
import RecipeLibrary from "./pages/RecipeLibrary/RecipeLibrary";
import Profile from "./pages/Profile/Profile";
import Community from "./pages/Community/Community";
import LoginPopup from "./components/LoginPopup/LoginPopup";
import NotificationSetup from "./components/NotificationSetup/NotificationSetup";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import Landing from "./pages/Landing/Landing";
import Onboarding from "./pages/Onboarding/Onboarding";
import PlanPrice from "./pages/PlanPrice/PlanPrice";
import Payment from "./pages/Payment/Payment";
import PlanSelection from "./pages/PlanSelection/PlanSelection";
import MealPlanPreview from "./pages/MealPlanPreview/MealPlanPreview";
import { StoreContext } from "./context/StoreContext";
import { NotificationContext } from "./context/NotificationContext";
import NotificationService from "./services/notificationService";
import "./App.css";

const App = () => {
  const { showLogin, setShowLogin, token, hasCompletedOnboarding } = useContext(StoreContext);
  const { addNotification } = useContext(NotificationContext);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { url } = useContext(StoreContext);
  const [draftCheckDone, setDraftCheckDone] = useState(false);

  // Initialize notifications on app mount (but don't request permission yet)
  useEffect(() => {
    const initNotifications = async () => {
      try {
        await NotificationService.init();
        NotificationService.setNotificationCallback(addNotification);
        // Just initialize service worker, don't request permission or subscribe yet
        // Permission will be requested only when user performs an action that uses notifications
      } catch (error) {
        console.error('Notification init failed:', error);
        // Don't break app if notification service fails
      }
    };

    if (token) {
      initNotifications();
    }
  }, [token, addNotification]);



  // Check for draft meal plan on app mount or when token changes
  useEffect(() => {
    const checkForDraft = async () => {
      // Only check for draft if NOT already on plan-selection or onboarding
      // User might be navigating back intentionally
      if (token && location.pathname !== '/generate-plan' && 
          location.pathname !== '/plan-selection' && 
          location.pathname !== '/plan-price' &&
          location.pathname !== '/payment' &&
          location.pathname !== '/onboarding') {
        try {
          const response = await axios.post(
            `${url}/api/meal-plan/get-draft`,
            {},
            { headers: { token } }
          );

          if (response.data.success && response.data.mealPlan) {
            const draftPlan = response.data.mealPlan;
            
            if (draftPlan.status === 'draft') {
              navigate('/generate-plan', {
                state: {
                  planType: draftPlan.planType,
                  duration: draftPlan.duration
                },
                replace: true
              });
              setDraftCheckDone(true);
              return;
            }
          }
        } catch (error) {
          // No draft plan found
        }
      }
      setDraftCheckDone(true);
    };

    checkForDraft();
  }, [token, url, navigate]);
  
  // Redirect logic based on authentication and onboarding status
  useEffect(() => {
    if (!draftCheckDone) return; // Wait for draft check

    console.log('\n⚫ App useEffect - checking redirects');
    console.log('   pathname:', location.pathname);
    console.log('   token:', token ? 'YES' : 'NO');
    
    if (!token && location.pathname !== '/') {
      console.log('🔴 REDIRECT: No token, redirecting to /');
      navigate('/');
    } else if (token && location.pathname === '/') {
      // If logged in but on landing page, check onboarding status
      if (!hasCompletedOnboarding) {
        navigate('/onboarding');
      } else {
        navigate('/home');
      }
    } else if (token && !hasCompletedOnboarding && location.pathname !== '/onboarding') {
      // If logged in but haven't completed onboarding, redirect to onboarding
      navigate('/onboarding');
    } else if (token && hasCompletedOnboarding && location.pathname === '/onboarding') {
      // If already completed onboarding, don't allow access to onboarding page
      navigate('/home');
    }
  }, [token, hasCompletedOnboarding, location.pathname, navigate]);

  useEffect(() => {
    if (location.pathname === '/community') {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }
  }, [location.pathname]);

  // Show landing page for non-authenticated users
  if (!token) {
    console.log('\n🟠 NO TOKEN - Showing landing page');
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
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </div>
      </>
    );
  }

  // Show onboarding and plan selection pages without sidebar/header
  if (location.pathname === '/onboarding' || location.pathname === '/plan-price' || location.pathname === '/payment' || location.pathname === '/plan-selection' || location.pathname === '/generate-plan') {
    console.log('\n🟢 Showing page WITHOUT sidebar/header');
    console.log('   pathname:', location.pathname);
    console.log('   Rendering MealPlanPreview with location.state:', location.state);
    return (
      <div className="app-welcome">
        <ToastContainer />
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/plan-price" element={<PlanPrice />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/plan-selection" element={<PlanSelection />} />
          <Route path="/generate-plan" element={<MealPlanPreview key={JSON.stringify(location.state)} />} />
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
          <NotificationSetup />
          <div className="dashboard-content">
            <Routes>
              <Route path="/home" element={<Home />} />
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
