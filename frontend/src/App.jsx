import { useState, useContext, useEffect, useRef } from "react";
import { Route, Routes, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import Home from "./pages/Home/Home";
import RecipeLibrary from "./pages/RecipeLibrary/RecipeLibrary";
import Profile from "./pages/Profile/Profile";
import Community from "./pages/Community/Community";
import LoginPopup from "./components/LoginPopup/LoginPopup";

import Sidebar from "./components/Sidebar/Sidebar";
import Header from "./components/Header/Header";
import Landing from "./pages/Landing/Landing";
import Terms from "./pages/Legal/Terms";
import Privacy from "./pages/Legal/Privacy";
import Contact from "./pages/Legal/Contact";
import Onboarding from "./pages/Onboarding/Onboarding";
import Payment from "./pages/Payment/Payment";
import MealPlanPreview from "./pages/MealPlanPreview/MealPlanPreview";
// import Consultation from "./pages/Consultation/Consultation"; // tạm ẩn
import { StoreContext } from "./context/StoreContext";
import AdminPanel from "./pages/Admin/AdminPanel";
import { notificationService } from "./services/notificationService";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
const App = () => {
  const { showLogin, setShowLogin, token, hasCompletedOnboarding, isInitialized, darkMode } = useContext(StoreContext);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { url } = useContext(StoreContext);
  const [draftCheckDone, setDraftCheckDone] = useState(false);
  const draftCheckRunRef = useRef(false); // prevent re-run on every pathname change
  const publicPaths = ["/", "/terms", "/privacy", "/contact", "/onboarding"];

  // Apply / remove dark mode class on <html> — excludes landing and legal pages
  useEffect(() => {
    const isPublicPage = publicPaths.includes(location.pathname);
    if (darkMode && !isPublicPage) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode, location.pathname]);

  // Initialize notifications on app mount (but don't request permission yet)
  useEffect(() => {
    const initNotifications = async () => {
      try {
        await notificationService.init();
        // Just initialize service worker, don't request permission or subscribe yet
        // Permission will be requested only when user performs an action that uses notifications
      } catch (error) {
        console.error('Notification init failed:', error);
        // Don't break app if notification service fails
      }
    };

    initNotifications();

    // On LAN HTTP origins, service worker may be unavailable; never crash app.
    if (navigator.serviceWorker) {
      const onMessage = (event) => {
        if (event?.data?.type === 'PUSH_RECEIVED') {
          console.log(event.data.message);
        }
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      };
    }
  }, []);
  // Auto-subscribe to notifications when user logs in
  useEffect(() => {
    const autoSubscribe = async () => {
      if (token) {
        try {
          const hasPermission = await notificationService.requestPermission();
          if (hasPermission) {
            await notificationService.subscribe();
            console.log('✅ Auto-subscribed to notifications');
          }
        } catch (error) {
          console.error('Auto-subscribe failed:', error);
        }
      }
    };

    autoSubscribe();
  }, [token]);


  // Check for draft meal plan on app mount or when token changes.
  // NOTE: location.pathname is intentionally NOT in deps — including it causes an
  // infinite redirect loop: draft found → navigate /generate-plan → fetchDraftMealPlan
  // error → navigate /home → pathname changes → this effect re-runs → repeat.
  // draftCheckRunRef ensures the check runs at most once per token session.
  useEffect(() => {
    if (!isInitialized) return;
    draftCheckRunRef.current = false; // reset when token changes (login/logout)
    const checkForDraft = async () => {
      if (draftCheckRunRef.current) return;
      draftCheckRunRef.current = true;

      const currentPath = window.location.pathname;
      if (token && currentPath !== '/generate-plan' &&
          currentPath !== '/payment' &&
          currentPath !== '/onboarding' &&
          !currentPath.startsWith('/admin')) {
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
  }, [token, url, navigate, isInitialized]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Redirect logic based on authentication and onboarding status
  useEffect(() => {
    if (!draftCheckDone) return; // Wait for draft check
    if (!isInitialized) return; // Wait for token to load from localStorage
    // Admin paths are self-managed
    if (location.pathname.startsWith("/admin")) return;

    console.log('\n⚫ App useEffect - checking redirects');
    console.log('   pathname:', location.pathname);
    console.log('   token:', token ? 'YES' : 'NO');
    
    if (!token && !publicPaths.includes(location.pathname)) {
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
  }, [token, hasCompletedOnboarding, location.pathname, navigate, draftCheckDone, isInitialized]);

  useEffect(() => {
    if (location.pathname === '/community') {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }
  }, [location.pathname]);

  // Wait for localStorage to be read before making any routing decisions
  if (!isInitialized) {
    return null;
  }

  // Admin panel — fully standalone, bypass all normal app logic
  if (location.pathname.startsWith("/admin")) {
    return <AdminPanel />;
  }

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
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </div>
      </>
    );
  }

  // Show onboarding and plan selection pages without sidebar/header
  if (location.pathname === '/onboarding' || location.pathname === '/payment' || location.pathname === '/generate-plan') {
    console.log('\n🟢 Showing page WITHOUT sidebar/header');
    console.log('   pathname:', location.pathname);
    console.log('   Rendering MealPlanPreview with location.state:', location.state);
    return (
      <div className="app-welcome">
        <ToastContainer
          position="top-right"
          autoClose={2500}
          hideProgressBar={true}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="light"
          style={{ zIndex: 99999 }}
          toastStyle={{
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: '12px 16px',
          }}
        />
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/generate-plan" element={<MealPlanPreview key={JSON.stringify(location.state)} />} />
        </Routes>
      </div>
    );
  }
  
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={true}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme={darkMode ? 'dark' : 'light'}
        style={{ zIndex: 99999 }}
        toastStyle={{
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          padding: '12px 16px',
        }}
      />
      {showLogin.show ? (
        <LoginPopup 
          setShowLogin={setShowLogin} 
          initialMode={showLogin.mode} 
        />
      ) : null}
      <div className="app">
        <Sidebar isCollapsed={sidebarCollapsed} setIsCollapsed={setSidebarCollapsed} />
        <div className={`dashboard-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Header />
          <div className="dashboard-content">
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/recipes" element={<RecipeLibrary />} />
              <Route path="/recipes/:id" element={<RecipeLibrary />} />
              <Route path="/community" element={<Community />} />
              <Route path="/myprofile" element={<Profile />} />
              {/* <Route path="/consultation" element={<Consultation />} /> */}{/* tạm ẩn */}
            </Routes>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
