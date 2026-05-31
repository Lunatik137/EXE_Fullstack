import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import './Header.css';
import { StoreContext } from '../../context/StoreContext';
import { assets } from '../../assets/frontend_assets/assets';
import streakIconSheet from '../../assets/frontend_assets/greenpath_streak_icon_sheet.svg';
import { getAvatarUrl } from '../../utils/avatar';
import { getRecipeImageUrl } from '../../utils/recipeImage';

const STREAK_ICON_VERSION = '20260531c';
const STREAK_ICON_FRAMES = 6;
const STREAK_PANEL_ICON_SIZE = 80;
const STREAK_TRIGGER_ICON_SIZE = 30;

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [communityResults, setCommunityResults] = useState({ users: [], totalUsers: 0 });
  const [notifications, setNotifications] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [streakStatus, setStreakStatus] = useState(null);
  const [showStreakPanel, setShowStreakPanel] = useState(false);
  const [loadingStreak, setLoadingStreak] = useState(false);
  const [recoveringStreak, setRecoveringStreak] = useState(false);

  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { token, setToken, setShowLogin, setHasCompletedOnboarding, url, darkMode, toggleDarkMode } = useContext(StoreContext);
  const INITIAL_VISIBLE_NOTIFICATIONS = 4;

  const isCommunityPage = location.pathname === '/community';
  const isHomePage = location.pathname === '/home';
  const isRecipePage = location.pathname.startsWith('/recipes');
  const communityParams = isCommunityPage ? new URLSearchParams(location.search) : null;
  const communitySearchQuery = communityParams?.get('search') || null;
  const communitySubPage = isCommunityPage && (communityParams?.get('search') || communityParams?.get('user') || communityParams?.get('restaurant'));

  const getStreakTier = (streakDays = 0) => {
    if (streakDays < 3) {
      return { key: 'seed', label: 'Seed Tier' };
    }
    if (streakDays < 7) {
      return { key: 'sprout', label: 'Sprout Tier' };
    }
    if (streakDays < 14) {
      return { key: 'growth', label: 'Growth Tier' };
    }
    if (streakDays < 30) {
      return { key: 'forest', label: 'Forest Tier' };
    }
    if (streakDays < 90) {
      return { key: 'flame', label: 'Flame Tier' };
    }

    return { key: 'legendary', label: 'Legendary Tier' };
  };

  const getStreakMessage = (streakDays = 0, lostStreak = false) => {
    if (lostStreak) {
      return 'Bạn vừa mất chuỗi, hãy phục hồi ngay để giữ nhịp hành trình.';
    }
    if (streakDays >= 90) {
      return 'Danh hiệu huyền thoại! Bạn đang duy trì thói quen khỏe mạnh ở đẳng cấp rất hiếm.';
    }
    if (streakDays >= 30) {
      return 'Phong độ rực cháy, bạn đang duy trì kỷ luật ăn uống ổn định và mạnh mẽ mỗi ngày.';
    }
    if (streakDays >= 14) {
      return 'Rất tốt, bạn đã tạo được nhịp ăn đều và ổn định suốt nhiều ngày.';
    }
    if (streakDays >= 7) {
      return 'Đã vào guồng, chỉ cần giữ đều mỗi ngày để lên tier tiếp theo.';
    }
    if (streakDays >= 3) {
      return 'Đà đang lên, cố gắng giữ chuỗi qua tuần này.';
    }

    return 'Khởi động nhẹ nhàng, xác nhận bữa hằng ngày để bắt đầu chuỗi mới.';
  };

  const getStreakFlameIconIndex = (streakDays = 0) => {
    if (streakDays < 3) return 0;
    if (streakDays < 7) return 1;
    if (streakDays < 14) return 2;
    if (streakDays < 30) return 3;
    if (streakDays < 90) return 4;
    return 5;
  };

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      return;
    }

    try {
      const response = await axios.get(`${url}/api/notifications/list`, {
        headers: { token }
      });

      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [token, url]);

  const fetchStreakStatus = useCallback(async () => {
    if (!token || !isHomePage) {
      setStreakStatus(null);
      return;
    }

    try {
      setLoadingStreak(true);
      const response = await axios.post(
        `${url}/api/streak/status`,
        {},
        { headers: { token } }
      );

      if (response.data.success) {
        setStreakStatus(response.data.streak || null);
      }
    } catch (error) {
      console.error('Error fetching streak status:', error);
    } finally {
      setLoadingStreak(false);
    }
  }, [isHomePage, token, url]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('hasCompletedOnboarding');
    setToken('');
    setHasCompletedOnboarding(true);
    toast.success('Logout Successfully');
    navigate('/');
  };

  useEffect(() => {
    if (isCommunityPage) {
      // Community live search: show only user suggestions in dropdown.
      const searchCommunityUsers = async () => {
        if (!searchQuery.trim()) {
          setCommunityResults({ users: [], totalUsers: 0 });
          setShowSearchResults(false);
          return;
        }

        try {
          const usersRes = await axios.get(`${url}/api/user/search`, {
            params: { q: searchQuery, limit: 5 }
          });

          const users = usersRes.data.success ? usersRes.data.users : [];
          const totalUsers = usersRes.data.success ? (usersRes.data.totalUsers || users.length) : 0;
          setCommunityResults({ users, totalUsers });
          setShowSearchResults(users.length > 0);
        } catch (error) {
          console.error('Community search error:', error);
          setCommunityResults({ users: [], totalUsers: 0 });
          setShowSearchResults(false);
        }
      };

      const debounceTimer = setTimeout(searchCommunityUsers, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      // Default: recipe search
      const searchRecipes = async () => {
        if (!searchQuery.trim()) {
          setSearchResults([]);
          setShowSearchResults(false);
          return;
        }

        try {
          const response = await axios.get(`${url}/api/recipes/search`, {
            params: { query: searchQuery }
          });

          if (response.data.success) {
            setSearchResults(response.data.recipes.slice(0, 5));
            setShowSearchResults(true);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error('Search error:', error);
          setSearchResults([]);
        }
      };

      const debounceTimer = setTimeout(searchRecipes, 300);
      return () => clearTimeout(debounceTimer);
    }
  }, [searchQuery, url, isCommunityPage]);

  useEffect(() => {
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        fetchNotifications();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchStreakStatus();
  }, [fetchStreakStatus]);

  useEffect(() => {
    const handleStreakConfirmed = (event) => {
      setStreakStatus(event.detail);
    };
    window.addEventListener('streakConfirmed', handleStreakConfirmed);
    return () => window.removeEventListener('streakConfirmed', handleStreakConfirmed);
  }, []);

  useEffect(() => {
    const getCurrentUser = async () => {
      if (!token) {
        setCurrentUser(null);
        return;
      }

      try {
        const response = await axios.post(
          `${url}/api/user/profile`,
          {},
          { headers: { token } }
        );

        if (response.data.success) {
          setCurrentUser(response.data.user);
        }
      } catch (error) {
        console.error('Error getting user info:', error);
      }
    };

    getCurrentUser();
  }, [token, url]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }

      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationPanel(false);
        setShowAllNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setShowNotificationPanel(false);
    setShowAllNotifications(false);
    setShowStreakPanel(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showStreakPanel) return undefined;

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [showStreakPanel]);

  const handleResultClick = (recipeId) => {
    navigate(`/recipes/${recipeId}`);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleCommunityUserClick = (userId) => {
    setSearchQuery('');
    setShowSearchResults(false);
    navigate(`/community?user=${userId}`);
  };

  const handleViewAllUsers = () => {
    if (!searchQuery.trim()) return;
    setShowSearchResults(false);
    navigate(`/community?search=${encodeURIComponent(searchQuery.trim())}&users=all`);
    setSearchQuery('');
  };

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    setShowSearchResults(false);
    if (isCommunityPage) {
      navigate(`/community?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(`/recipes?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleStreakTriggerClick = async () => {
    if (showStreakPanel) {
      setShowStreakPanel(false);
      return;
    }

    setShowNotificationPanel(false);
    setShowAllNotifications(false);
    await fetchStreakStatus();
    setShowStreakPanel(true);
  };

  const handleRecoverStreak = async () => {
    if (!token) return;

    try {
      setRecoveringStreak(true);
      const response = await axios.post(
        `${url}/api/streak/recover`,
        {},
        { headers: { token } }
      );

      if (response.data.success) {
        setStreakStatus(response.data.streak || null);
        toast.success(response.data.message || 'Đã phục hồi chuỗi');
      } else {
        toast.error(response.data.message || 'Không thể phục hồi chuỗi');
      }
    } catch (error) {
      console.error('Error recovering streak:', error);
      toast.error('Có lỗi xảy ra khi phục hồi chuỗi');
    } finally {
      setRecoveringStreak(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.read).length;
  const visibleNotifications = showAllNotifications
    ? notifications
    : notifications.slice(0, INITIAL_VISIBLE_NOTIFICATIONS);
  const currentStreak = streakStatus?.currentStreak || 0;
  const todayConfirmedMeals = streakStatus?.todayProgress?.confirmedMeals || 0;
  const tier = getStreakTier(currentStreak);
  const hasLostStreak = Boolean(streakStatus && streakStatus.currentStreak === 0 && streakStatus.longestStreak > 0 && streakStatus.lastMissedDateKey);
  const canRecoverStreak = Boolean(hasLostStreak && streakStatus?.recovery?.remainingThisMonth && streakStatus?.recovery?.recoverableDateKey);
  const streakMessage = getStreakMessage(currentStreak, hasLostStreak);
  const streakIconIndex = getStreakFlameIconIndex(currentStreak);
  const streakFlameStyle = {
    backgroundImage: `url(${streakIconSheet}?v=${STREAK_ICON_VERSION})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${STREAK_PANEL_ICON_SIZE * STREAK_ICON_FRAMES}px ${STREAK_PANEL_ICON_SIZE}px`,
    backgroundPosition: `${-STREAK_PANEL_ICON_SIZE * streakIconIndex}px center`
  };

  const streakTriggerStyle = {
    backgroundImage: `url(${streakIconSheet}?v=${STREAK_ICON_VERSION})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${STREAK_TRIGGER_ICON_SIZE * STREAK_ICON_FRAMES}px ${STREAK_TRIGGER_ICON_SIZE}px`,
    backgroundPosition: `${-STREAK_TRIGGER_ICON_SIZE * streakIconIndex}px center`
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';

    const now = new Date();
    const value = new Date(date);
    const diffInSeconds = Math.floor((now - value) / 1000);

    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ`;
    return `${Math.floor(diffInSeconds / 86400)} ngày`;
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.read) {
        await axios.put(
          `${url}/api/notifications/${notification._id}/read`,
          {},
          { headers: { token } }
        );

        setNotifications((prev) => prev.map((item) => (
          item._id === notification._id ? { ...item, read: true } : item
        )));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }

    const notificationType = notification?.data?.type || notification?.type;
    setShowNotificationPanel(false);
    setShowAllNotifications(false);

    if (notificationType === 'comment' || notificationType === 'like') {
      const targetPostId = notification?.data?.postId;
      navigate(targetPostId
        ? `/community?post=${targetPostId}`
        : '/community');
      return;
    } else if (notificationType === 'follow') {
      const followerId = notification?.data?.followerId;
      navigate(followerId
        ? `/community?user=${followerId}`
        : '/community');
      return;
    } else if (notificationType === 'meal') {
      navigate('/home');
      return;
    }
  };

  const navbarAvatar = currentUser
    ? getAvatarUrl(currentUser.avatar, url, currentUser.name)
    : assets.profile_icon;

  return (
    <div className="header">
      {isCommunityPage && communitySubPage && (
        <button
          type="button"
          className="header-community-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Quay lại"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      )}
      {(isRecipePage || isCommunityPage) && (
      <div className="search-container" ref={searchRef}>
        {isCommunityPage || isRecipePage ? (
          <button
            type="button"
            className="search-icon search-icon-btn"
            onClick={handleSearchSubmit}
            aria-label="Tìm kiếm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
            </svg>
          </button>
        ) : (
          <span className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
            </svg>
          </span>
        )}
        <input
          type="text"
          placeholder={isCommunityPage ? 'Tìm kiếm người dùng, bài viết...' : 'Tìm kiếm công thức'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery && setShowSearchResults(true)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
          className="search-input"
        />

        {showSearchResults && !isCommunityPage && searchResults.length > 0 && (
          <div className="search-results-dropdown">
            {searchResults.map((item) => (
              <div
                key={item._id}
                className="search-result-item"
                onClick={() => handleResultClick(item._id)}
              >
                <img src={getRecipeImageUrl(item.image, url)} alt={item.name} className="result-image" />
                <div className="result-info">
                  <p className="result-name">{item.name}</p>
                  {item.description && (
                    <p className="result-description">{item.description.substring(0, 50)}...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showSearchResults && isCommunityPage && communityResults.users.length > 0 && (
          <div className="search-results-dropdown">
            <p className="search-section-label">Người dùng</p>
            {communityResults.users.map((user) => (
              <div
                key={user._id}
                className="search-result-item search-user-item"
                onClick={() => handleCommunityUserClick(user._id)}
              >
                <img
                  src={getAvatarUrl(user.avatar, url, user.name, 40)}
                  alt={user.name}
                  className="result-image result-avatar"
                />
                <div className="result-info">
                  <p className="result-name">{user.name}</p>
                  <p className="result-description search-user-meta">
                    {user.followersCount} người theo dõi · {user.postsCount} bài viết
                  </p>
                </div>
              </div>
            ))}
            {communityResults.totalUsers > 5 && (
              <button
                type="button"
                className="search-view-all-btn"
                onClick={handleViewAllUsers}
              >
                Xem tất cả
              </button>
            )}
          </div>
        )}

      </div>
      )}

      <div className="user-section">
        {token && isHomePage && currentUser?.planType === 'premium' && currentUser?.subscriptionStatus === 'active' && currentUser?.subscriptionEndDate && new Date(currentUser.subscriptionEndDate) > new Date() && (
          <>
            <button
              type="button"
              className="header-streak-trigger"
              onClick={handleStreakTriggerClick}
              aria-label="Xem streak"
            >
              <span className="header-streak-trigger-icon" style={streakTriggerStyle} aria-hidden="true" />
            </button>

            <div
              className={`header-streak-backdrop ${showStreakPanel ? 'open' : ''}`}
              onClick={() => setShowStreakPanel(false)}
            />

            <div className={`header-streak-panel ${showStreakPanel ? 'open' : ''}`}>
              <div className="header-streak-panel-shell">
                <button
                  type="button"
                  className="header-streak-close"
                  onClick={() => setShowStreakPanel(false)}
                  aria-label="Đóng streak"
                >
                  ✕
                </button>

                {loadingStreak ? (
                  <div className="header-streak-loading">Đang tải streak...</div>
                ) : streakStatus ? (
                  <div className={`progress-streak-summary-card tier-${tier.key}`}>
                    <div className="progress-streak-spotlight">
                      <div>
                        <p className="progress-streak-kicker">Streak Mode</p>
                        <h4 className="progress-streak-hero">{tier.label}</h4>
                        <p className="progress-streak-copy">{streakMessage}</p>
                      </div>
                      <div className="progress-streak-flame" aria-label="Streak achievement badge">
                        <div className="progress-streak-flame-icon" style={streakFlameStyle} />
                      </div>
                    </div>
                    <div className="progress-streak-grid">
                      <div>
                        <p className="progress-streak-label">Chuỗi</p>
                        <h4 className="progress-streak-value">{currentStreak} ngày</h4>
                      </div>
                      <div>
                        <p className="progress-streak-label">Kỷ lục</p>
                        <h4 className="progress-streak-value">{streakStatus.longestStreak} ngày</h4>
                      </div>
                      <div>
                        <p className="progress-streak-label">Hôm nay</p>
                        <h4 className="progress-streak-value">{todayConfirmedMeals}/3 bữa</h4>
                      </div>
                    </div>
                    <div className="progress-streak-footer">
                      <span>Cần xác nhận tối thiểu 2/3 bữa để giữ chuỗi.</span>
                      <span>Phục hồi tháng này: {streakStatus.recovery?.remainingThisMonth || 0}/1</span>
                    </div>

                    {hasLostStreak && (
                      <div className="progress-streak-recovery-row">
                        <div>
                          <p className="progress-streak-recovery-title">Mất chuỗi - phục hồi ngay</p>
                          <p className="progress-streak-recovery-text">
                            {streakStatus.recovery?.recoverableDateKey
                              ? `Bạn có thể cứu lại ngày ${streakStatus.recovery.recoverableDateKey}.`
                              : 'Chưa có ngày nào đủ điều kiện để phục hồi.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="progress-streak-recover-btn"
                          onClick={handleRecoverStreak}
                          disabled={!canRecoverStreak || recoveringStreak}
                        >
                          {recoveringStreak ? 'Đang phục hồi...' : 'Phục hồi chuỗi'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="header-streak-empty">Chưa có dữ liệu streak.</div>
                )}
              </div>
            </div>
          </>
        )}

        {token && (
          <div className="notification-wrapper" ref={notificationRef}>
            <button
              className="notification-trigger"
              type="button"
              onClick={() => {
                setShowNotificationPanel((prev) => !prev);
                setShowAllNotifications(false);
                fetchNotifications();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" className="notification-icon" viewBox="0 0 16 16">
                <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6" />
              </svg>
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {showNotificationPanel && (
              <div className="notification-dropdown">
                <div className="notification-dropdown-header">
                  <h4>Thông báo</h4>
                  <button type="button" onClick={fetchNotifications}>Làm mới</button>
                </div>

                <div className={`notification-list ${showAllNotifications ? 'scrollable' : ''}`}>
                  {visibleNotifications.length === 0 ? (
                    <p className="notification-empty">Chưa có thông báo nào.</p>
                  ) : (
                    visibleNotifications.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        className={`notification-item ${item.read ? 'read' : 'unread'}`}
                        onClick={() => handleNotificationClick(item)}
                      >
                        {item.type === 'like' || item.type === 'comment' || item.type === 'follow' ? (
                          <div className="notification-avatar-wrapper">
                            <img
                              className="notification-avatar-image"
                              src={getAvatarUrl(item?.data?.userAvatar, url, item?.data?.userName || 'User', 64)}
                              alt={item?.data?.userName || 'User'}
                            />
                            {item.type === 'like' && (
                              <span className="notification-type-badge badge-like">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5">
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                              </span>
                            )}
                            {item.type === 'comment' && (
                              <span className="notification-type-badge badge-comment">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="#3b82f6" stroke="#3b82f6" strokeWidth="1.5">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                              </span>
                            )}
                            {item.type === 'follow' && (
                              <span className="notification-type-badge badge-follow">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="#8b5cf6" stroke="#8b5cf6" strokeWidth="1.5">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="notification-avatar">🍽</div>
                        )}
                        <div className="notification-content">
                          <p className="notification-title">{item.title.replace(/^[^\p{L}]+/u, '')}</p>
                          <p className="notification-body">{item.body}</p>
                          <span className="notification-time">{formatTimeAgo(item.createdAt)}</span>
                        </div>
                        {!item.read && <span className="notification-unread-dot" />}
                      </button>
                    ))
                  )}
                </div>

                {!showAllNotifications && notifications.length > INITIAL_VISIBLE_NOTIFICATIONS && (
                  <button
                    type="button"
                    className="notification-view-more"
                    onClick={() => setShowAllNotifications(true)}
                  >
                    Xem thông báo trước đó
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!token ? (
          <button className="signin-btn" onClick={() => setShowLogin({ show: true, mode: 'login' })}>SIGN IN</button>
        ) : (
          <div className="navbar-profile">
            <img src={navbarAvatar} alt="User avatar" />
            <ul className="nav-profile-dropdown">
              <li onClick={logout}>
                <img src={assets.logout_icon} alt="" />
                <p>Đăng Xuất</p>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
