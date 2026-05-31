import { useState, useContext, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Community.css';
import FilterSidebar from '../../components/FilterSidebar/FilterSidebar';
import CreatePost from '../../components/CreatePost/CreatePost';
import PostCard from '../../components/PostCard/PostCard';
import TrendingTopics from '../../components/TrendingTopics/TrendingTopics';
import RecipeDetailModal from '../../components/RecipeDetailModal/RecipeDetailModal';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { getAvatarUrl } from '../../utils/avatar';

const formatTimeAgo = (date) => {
  const now = new Date();
  const postDate = new Date(date);
  const diffInSeconds = Math.floor((now - postDate) / 1000);
  
  if (diffInSeconds < 60) return 'Vừa xong';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
  return `${Math.floor(diffInSeconds / 604800)} tuần trước`;
};

const transformPostData = (apiPost, baseUrl) => {
  // Nếu là bài review quán ăn, thêm tên quán vào sau tên user
  let author = apiPost.userId?.name || 'Người dùng ẩn danh';
  if (apiPost.type === 'review' && apiPost.reviewData?.restaurantName) {
    author = `${author} > ${apiPost.reviewData.restaurantName}`;
  }
  return {
    id: apiPost._id,
    authorId: apiPost.userId?._id || null,
    author,
    avatar: getAvatarUrl(apiPost.userId?.avatar, baseUrl, apiPost.userId?.name || 'User', 50),
    time: formatTimeAgo(apiPost.createdAt),
    content: apiPost.content,
    media: apiPost.media || [],
    verified: apiPost.userId?.verified || false,
    likes: apiPost.likes?.length || 0,
    likesArray: apiPost.likes || [],
    comments: apiPost.comments?.length || 0,
    commentsData: apiPost.comments || [],
    recipe: apiPost.recipeData || null,
    reviewData: apiPost.reviewData || null,
    type: apiPost.type,
    hashtags: apiPost.hashtags || [],
    createdAt: apiPost.createdAt || null
  };
};

const Community = () => {
  return (
    <div className="community-coming-soon">
      <div className="community-coming-soon-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 16 16">
          <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />
        </svg>
      </div>
      <h2 className="community-coming-soon-title">
        Tính năng đang được phát triển
      </h2>
      <p className="community-coming-soon-desc">
        Trang <strong>Cộng đồng</strong> hiện đang trong quá trình hoàn thiện.
        Chúng tôi đang nỗ lực xây dựng không gian để mọi người cùng chia sẻ công thức,
        kinh nghiệm ăn uống lành mạnh và truyền cảm hứng cho nhau.
        Hãy đón chờ nhé! 
      </p>
      <div className="community-coming-soon-badge">Sắp ra mắt</div>
    </div>
  );

  /* ===== code bên dưới tạm ẩn, giữ lại để khôi phục sau ===== */
  // eslint-disable-next-line no-unreachable
  const { url, token } = useContext(StoreContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [selectedHashtag, setSelectedHashtag] = useState(null);
  const [sidebarOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileFilterTemp, setMobileFilterTemp] = useState('all');
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [focusedUserSort, setFocusedUserSort] = useState('newest');
  const [searchFilter, setSearchFilter] = useState('all');
  const [searchUserResults, setSearchUserResults] = useState([]);
  const [searchUsersOnly, setSearchUsersOnly] = useState(false);
  const [searchRestaurantResults, setSearchRestaurantResults] = useState([]);
  const [followActionUserId, setFollowActionUserId] = useState(null);
  const [pendingUnfollowUserId, setPendingUnfollowUserId] = useState(null);
  const [focusedUserProfile, setFocusedUserProfile] = useState(null);
  const [focusedUserProfileLoading, setFocusedUserProfileLoading] = useState(false);
  const [restaurantProfile, setRestaurantProfile] = useState(null);
  const [restaurantProfileLoading] = useState(false);
  const [restaurantSort, setRestaurantSort] = useState('newest');
  const focusedPostId = new URLSearchParams(location.search).get('post');
  const focusedUserId = new URLSearchParams(location.search).get('user');
  const focusedSearch = new URLSearchParams(location.search).get('search');
  const focusedFilterParam = new URLSearchParams(location.search).get('filter');
  const focusedRestaurant = new URLSearchParams(location.search).get('restaurant');
  const followingIds = new Set((currentUser?.following || []).map((item) => String(item)));

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      let endpoint;

      if (focusedRestaurant) {
        const encoded = encodeURIComponent(focusedRestaurant);
        const res = await axios.get(`${url}/api/posts/by-restaurant/${encoded}`);
        if (res.data.success) {
          const transformed = res.data.posts.map((post) => transformPostData(post, url));
          const sorted = [...transformed].sort((a, b) => {
            if (restaurantSort === 'most-liked') {
              if ((b.likes || 0) === (a.likes || 0)) return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
              return (b.likes || 0) - (a.likes || 0);
            }
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });
          setPosts(sorted);
          setRestaurantProfile({
            name: focusedRestaurant,
            reviewCount: res.data.stats?.reviewCount || 0,
            avgRating: res.data.stats?.avgRating || null,
            location: res.data.stats?.location || null,
          });
        } else {
          setPosts([]);
          setRestaurantProfile({ name: focusedRestaurant, reviewCount: 0, avgRating: null, location: null });
        }
        return;
      }

      if (focusedPostId) {
        const singlePostResponse = await axios.get(`${url}/api/posts/${focusedPostId}`);
        if (singlePostResponse.data.success && singlePostResponse.data.post) {
          setPosts([transformPostData(singlePostResponse.data.post, url)]);
        } else {
          setPosts([]);
        }
        return;
      }

      if (focusedUserId) {
        const userPostsResponse = await axios.get(`${url}/api/posts/by-user/${focusedUserId}`);
        if (userPostsResponse.data.success) {
          const transformedPosts = userPostsResponse.data.posts.map((post) => transformPostData(post, url));
          const sortedPosts = [...transformedPosts].sort((a, b) => {
            if (focusedUserSort === 'most-liked') {
              if ((b.likes || 0) === (a.likes || 0)) {
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
              }
              return (b.likes || 0) - (a.likes || 0);
            }
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });
          setPosts(sortedPosts);
        } else {
          setPosts([]);
        }
        return;
      }

      if (focusedSearch) {
        const isUsersOnly = searchFilter === 'users';
        const isPostsOnly = searchFilter === 'posts';
        const isReviewOnly = searchFilter === 'review';

        const usersForPostMatchRequest = (isUsersOnly || isReviewOnly)
          ? Promise.resolve({ data: { success: true, users: [] } })
          : axios.get(`${url}/api/user/search`, { params: { q: focusedSearch, limit: 50 } });
        const usersRequest = (isPostsOnly || isReviewOnly)
          ? Promise.resolve({ data: { success: true, users: [] } })
          : axios.get(`${url}/api/user/search`, {
              params: isUsersOnly ? { q: focusedSearch } : { q: focusedSearch, limit: 5 }
            });
        const postsRequest = isUsersOnly
          ? Promise.resolve({ data: { success: true, posts: [] } })
          : axios.get(`${url}/api/posts/search`, { params: { q: focusedSearch } });

        const [usersForPostMatchRes, usersRes, postsRes] = await Promise.all([
          usersForPostMatchRequest,
          usersRequest,
          postsRequest
        ]);
        setSearchUserResults(usersRes.data.success ? (usersRes.data.users || []) : []);
        setSearchUsersOnly(isUsersOnly);

        let allMatchedPosts = postsRes.data.success ? (postsRes.data.posts || []) : [];

        // Also search posts by author name (skip for review/users-only)
        if (!isUsersOnly && !isReviewOnly) {
          const nameMatchedUsers = usersForPostMatchRes.data.success
            ? (usersForPostMatchRes.data.users || [])
            : [];
          if (nameMatchedUsers.length > 0) {
            const userPostResponses = await Promise.all(
              nameMatchedUsers
                .map((user) => user?._id)
                .filter(Boolean)
                .map((userId) => axios
                  .get(`${url}/api/posts/by-user/${userId}`)
                  .catch(() => ({ data: { success: false, posts: [] } })))
            );
            const authorNameMatchedPosts = userPostResponses.flatMap((response) => (
              response.data.success ? (response.data.posts || []) : []
            ));
            allMatchedPosts = [...allMatchedPosts, ...authorNameMatchedPosts];
          }
        }

        const mergedPostsMap = new Map();
        allMatchedPosts.forEach((post) => {
          if (post?._id) mergedPostsMap.set(String(post._id), post);
        });

        let mergedPosts = Array.from(mergedPostsMap.values()).sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );

        // When review filter: aggregate unique restaurants, show as cards
        if (isReviewOnly) {
          const reviewPosts = mergedPosts.filter((p) => p.type === 'review');
          const restaurantMap = new Map();
          reviewPosts.forEach((p) => {
            const name = p.reviewData?.restaurantName;
            if (!name) return;
            if (!restaurantMap.has(name)) {
              restaurantMap.set(name, { name, location: p.reviewData?.location || null, ratings: [], reviewCount: 0 });
            }
            const entry = restaurantMap.get(name);
            entry.reviewCount += 1;
            if (p.reviewData?.rating) entry.ratings.push(p.reviewData.rating);
          });
          const restaurants = Array.from(restaurantMap.values()).map((r) => ({
            ...r,
            avgRating: r.ratings.length > 0
              ? Math.round(r.ratings.reduce((s, v) => s + v, 0) / r.ratings.length * 10) / 10
              : null,
          }));
          setSearchRestaurantResults(restaurants);
          setSearchUsersOnly(true);
          setPosts([]);
          return;
        }

        setSearchRestaurantResults([]);
        // For 'all' filter, also extract restaurant cards from review posts
        if (!isPostsOnly) {
          const reviewPosts = mergedPosts.filter((p) => p.type === 'review');
          if (reviewPosts.length > 0) {
            const restaurantMap = new Map();
            reviewPosts.forEach((p) => {
              const name = p.reviewData?.restaurantName;
              if (!name) return;
              if (!restaurantMap.has(name)) {
                restaurantMap.set(name, { name, location: p.reviewData?.location || null, ratings: [], reviewCount: 0 });
              }
              const entry = restaurantMap.get(name);
              entry.reviewCount += 1;
              if (p.reviewData?.rating) entry.ratings.push(p.reviewData.rating);
            });
            const restaurants = Array.from(restaurantMap.values()).map((r) => ({
              ...r,
              avgRating: r.ratings.length > 0
                ? Math.round(r.ratings.reduce((s, v) => s + v, 0) / r.ratings.length * 10) / 10
                : null,
            }));
            setSearchRestaurantResults(restaurants);
          }
        }
        setPosts(mergedPosts.map((post) => transformPostData(post, url)));
        return;
      }

      setSearchUsersOnly(false);
      setSearchUserResults([]);
      setSearchRestaurantResults([]);
      
      if (selectedHashtag) {
        // Filter by hashtag (remove # if present)
        const hashtagValue = selectedHashtag.replace('#', '');
        endpoint = `${url}/api/posts/hashtag/${hashtagValue}`;
      } else if (filterType === 'my-posts') {
        const res = await axios.post(`${url}/api/posts/my-posts`, {}, { headers: { token } });
        if (res.data.success) {
          setPosts(res.data.posts.map((post) => transformPostData(post, url)));
        } else {
          setPosts([]);
        }
        return;
      } else if (filterType === 'following-posts') {
        const res = await axios.post(`${url}/api/posts/following-posts`, {}, { headers: { token } });
        if (res.data.success) {
          setPosts(res.data.posts.map((post) => transformPostData(post, url)));
        } else {
          setPosts([]);
        }
        return;
      } else if (filterType === 'liked-posts') {
        const res = await axios.post(`${url}/api/posts/liked-posts`, {}, { headers: { token } });
        if (res.data.success) {
          setPosts(res.data.posts.map((post) => transformPostData(post, url)));
        } else {
          setPosts([]);
        }
        return;
      } else if (filterType === 'all') {
        endpoint = `${url}/api/posts`;
      } else {
        endpoint = `${url}/api/posts/type/${filterType}`;
      }
      
      const response = await axios.get(endpoint);
      
      if (response.data.success) {
        const transformedPosts = response.data.posts.map((post) => transformPostData(post, url));
        setPosts(transformedPosts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, [url, token, filterType, selectedHashtag, focusedPostId, focusedUserId, focusedSearch, focusedUserSort, searchFilter, focusedRestaurant, restaurantSort]);

  useEffect(() => {
    if (!focusedRestaurant) {
      setRestaurantSort('newest');
      setRestaurantProfile(null);
    }
  }, [focusedRestaurant]);

  useEffect(() => {
    if (!focusedUserId) {
      setFocusedUserSort('newest');
    } else {
      setSelectedHashtag(null);
    }
  }, [focusedUserId]);

  useEffect(() => {
    const validFilters = ['all', 'users', 'posts', 'review'];
    setSearchFilter(validFilters.includes(focusedFilterParam) ? focusedFilterParam : 'all');
  }, [focusedSearch, focusedFilterParam]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) {
        setCurrentUser(null);
        setCurrentUserId(null);
        return;
      }
      try {
        const response = await axios.post(
          `${url}/api/user/profile`,
          {},
          { headers: { token } }
        );
        if (response.data.success) {
          setCurrentUser(response.data.user || null);
          setCurrentUserId(response.data.user?._id || null);
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
        setCurrentUser(null);
        setCurrentUserId(null);
      }
    };

    fetchCurrentUser();
  }, [token, url]);

  useEffect(() => {
    const fetchFocusedUserProfile = async () => {
      if (!focusedUserId) {
        setFocusedUserProfile(null);
        return;
      }

      try {
        setFocusedUserProfileLoading(true);
        const response = await axios.get(`${url}/api/user/${focusedUserId}/profile`);
        if (response.data.success) {
          const profile = response.data.user || {};
          setFocusedUserProfile({
            _id: profile._id,
            name: profile.name || 'Người dùng',
            avatar: profile.avatar || '',
            followersCount: Array.isArray(profile.followers) ? profile.followers.length : 0,
            postsCount: profile.postsCount ?? null,
            description: profile.description || profile.bio || profile.about || ''
          });
        } else {
          setFocusedUserProfile(null);
        }
      } catch (error) {
        console.error('Error fetching focused user profile:', error);
        setFocusedUserProfile(null);
      } finally {
        setFocusedUserProfileLoading(false);
      }
    };

    fetchFocusedUserProfile();
  }, [focusedUserId, url]);

  const handlePostCreated = () => {
    fetchPosts();
  };

  const handleHashtagClick = (hashtag) => {
    if (focusedPostId) return;
    setSelectedHashtag(hashtag);
    setFilterType('all'); // Reset filter type when selecting hashtag
  };

  const handleFilterChange = (newFilterType) => {
    if (focusedPostId) return;
    setFilterType(newFilterType);
    setSelectedHashtag(null); // Reset hashtag when changing filter type
  };

  const handleViewRecipe = (post) => {
    if (post.recipe) {
      setSelectedRecipe({
        ...post.recipe,
        author: post.author,
        authorAvatar: post.avatar,
        image: post.media?.[0]?.url ? `${url}/images/posts/${post.media[0].url}` : null,
      });
    }
  };

  const handleSearchUserClick = (userId) => {
    navigate(`/community?user=${userId}`);
  };

  const handleToggleFollow = async (event, targetUserId) => {
    event?.stopPropagation();

    if (!targetUserId || String(targetUserId) === String(currentUserId)) {
      return;
    }

    if (!token) {
      alert('Vui lòng đăng nhập để theo dõi người dùng');
      return;
    }

    const isFollowing = followingIds.has(String(targetUserId));
    if (isFollowing) {
      setPendingUnfollowUserId(String(targetUserId));
      return;
    }

    setFollowActionUserId(String(targetUserId));

    try {
      const endpoint = isFollowing
        ? `${url}/api/user/${targetUserId}/unfollow`
        : `${url}/api/user/${targetUserId}/follow`;

      await axios.post(endpoint, {}, { headers: { token } });

      setCurrentUser((prev) => {
        if (!prev) return prev;

        const previousFollowing = Array.isArray(prev.following) ? prev.following : [];
        const nextFollowing = isFollowing
          ? previousFollowing.filter((item) => String(item) !== String(targetUserId))
          : [...previousFollowing, targetUserId];

        return {
          ...prev,
          following: nextFollowing
        };
      });

      setSearchUserResults((prev) => prev.map((user) => {
        if (String(user._id) !== String(targetUserId)) {
          return user;
        }

        const currentFollowersCount = Number(user.followersCount) || 0;
        return {
          ...user,
          followersCount: isFollowing
            ? Math.max(0, currentFollowersCount - 1)
            : currentFollowersCount + 1
        };
      }));

      setFocusedUserProfile((prev) => {
        if (!prev || String(prev._id) !== String(targetUserId)) {
          return prev;
        }

        const currentFollowersCount = Number(prev.followersCount) || 0;
        return {
          ...prev,
          followersCount: isFollowing
            ? Math.max(0, currentFollowersCount - 1)
            : currentFollowersCount + 1
        };
      });
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowActionUserId(null);
    }
  };

  const handleConfirmUnfollow = async () => {
    const targetUserId = pendingUnfollowUserId;
    if (!targetUserId) return;

    setPendingUnfollowUserId(null);
    await handleToggleFollow(null, targetUserId);
  };

  const handleLikePost = async (postId) => {
    if (!token) {
      alert('Vui lòng đăng nhập để thích bài viết');
      return;
    }

    try {
      const response = await axios.post(
        `${url}/api/posts/${postId}/like`,
        {},
        { headers: { token } }
      );

      if (response.data.success) {
        setPosts((prevPosts) => prevPosts.map((post) => {
          if (post.id !== postId) return post;

          const currentLikesArray = Array.isArray(post.likesArray) ? post.likesArray : [];
          const userIdAsString = String(currentUserId || '');
          const hasLiked = currentLikesArray.some((id) => String(id) === userIdAsString);

          return {
            ...post,
            likesArray: hasLiked
              ? currentLikesArray.filter((id) => String(id) !== userIdAsString)
              : [...currentLikesArray, currentUserId],
            likes: Number(response.data.likesCount) || 0,
          };
        }));
      }
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Không thể thích bài viết. Vui lòng thử lại.');
    }
  };

  const handleCommentPost = async (postId, comment) => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để bình luận');
      return;
    }

    if (!comment.trim()) {
      toast.error('Vui lòng nhập nội dung bình luận');
      return;
    }

    try {
      const response = await axios.post(
        `${url}/api/posts/${postId}/comment`,
        { content: comment },
        { headers: { token } }
      );

      if (response.data.success) {
        toast.success('Đã đăng bình luận!');
        setPosts((prevPosts) => prevPosts.map((post) => {
          if (post.id !== postId) return post;

          const nextComments = Array.isArray(response.data.comments)
            ? response.data.comments
            : post.commentsData || [];

          return {
            ...post,
            commentsData: nextComments,
            comments: nextComments.length,
          };
        }));
        return true;
      }
    } catch (error) {
      console.error('Error commenting on post:', error);
      toast.error('Không thể bình luận. Vui lòng thử lại.');
      return false;
    }
  };

  const shouldShowNoPosts = !searchUsersOnly
    && posts.length === 0
    && (!focusedSearch || searchFilter !== 'all' || (searchUserResults.length === 0 && searchRestaurantResults.length === 0));

  return (
    <>
      <div className="community-page">
        {(focusedUserId || focusedRestaurant) && (
          <div className="filter-sidebar">
            <h3 className="filter-title">Sắp xếp</h3>
            <div className="filter-list">
              <div
                className={`filter-item ${(focusedUserId ? focusedUserSort : restaurantSort) === 'newest' ? 'active' : ''}`}
                onClick={() => focusedUserId ? setFocusedUserSort('newest') : setRestaurantSort('newest')}
              >
                Mới nhất
              </div>
              <div
                className={`filter-item ${(focusedUserId ? focusedUserSort : restaurantSort) === 'most-liked' ? 'active' : ''}`}
                onClick={() => focusedUserId ? setFocusedUserSort('most-liked') : setRestaurantSort('most-liked')}
              >
                Nhiều like nhất
              </div>
            </div>
          </div>
        )}

        {!focusedUserId && !focusedRestaurant && focusedSearch && (
          <div className="filter-sidebar">
            <h3 className="filter-title">Bộ lọc tìm kiếm</h3>
            <div className="filter-list">
              <div
                className={`filter-item ${searchFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSearchFilter('all')}
              >
                Tất cả
              </div>
              <div
                className={`filter-item ${searchFilter === 'users' ? 'active' : ''}`}
                onClick={() => setSearchFilter('users')}
              >
                Người dùng
              </div>
              <div
                className={`filter-item ${searchFilter === 'posts' ? 'active' : ''}`}
                onClick={() => setSearchFilter('posts')}
              >
                Bài viết
              </div>
              <div
                className={`filter-item ${searchFilter === 'review' ? 'active' : ''}`}
                onClick={() => setSearchFilter('review')}
              >
                Quán ăn
              </div>
            </div>
          </div>
        )}

        {!focusedUserId && !focusedSearch && !focusedRestaurant && (
          <FilterSidebar onFilterChange={handleFilterChange} currentFilter={filterType} isOpen={sidebarOpen} token={token} />
        )}
        <div className="community-feed">
          {focusedRestaurant && (
            <div className="community-user-profile-header">
              {restaurantProfileLoading ? (
                <p className="community-user-profile-loading">Đang tải thông tin quán ăn...</p>
              ) : restaurantProfile ? (
                <div className="community-user-profile-main">
                  <div className="community-user-profile-content">
                    <h2 className="community-user-profile-name">{restaurantProfile.name}</h2>
                    {restaurantProfile.location && (
                      <p className="restaurant-profile-location">Đ/c: {restaurantProfile.location}</p>
                    )}
                    <div className="restaurant-profile-stats">
                      {restaurantProfile.avgRating !== null && (
                        <span className="restaurant-profile-rating">
                          <span className="restaurant-profile-stars">
                            {'★'.repeat(Math.round(restaurantProfile.avgRating))}{'☆'.repeat(5 - Math.round(restaurantProfile.avgRating))}
                          </span>
                          <strong>{restaurantProfile.avgRating}</strong>/5
                        </span>
                      )}
                      <span className="restaurant-profile-review-count">
                        {restaurantProfile.reviewCount} bài đánh giá
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="community-user-profile-loading">Không tìm thấy quán ăn.</p>
              )}
            </div>
          )}
          {focusedRestaurant && (
            <button className="mobile-sort-bar" onClick={() => setMobileSortOpen(true)}>
              <span>{restaurantSort === 'most-liked' ? 'Nhiều like nhất' : 'Mới nhất'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
            </button>
          )}

          {focusedUserId && (
            <div className="community-user-profile-header">
              {focusedUserProfileLoading ? (
                <p className="community-user-profile-loading">Đang tải thông tin người dùng...</p>
              ) : focusedUserProfile ? (
                <>
                  <div className="community-user-profile-main">
                    <img
                      src={getAvatarUrl(focusedUserProfile.avatar, url, focusedUserProfile.name, 84)}
                      alt={focusedUserProfile.name}
                      className="community-user-profile-avatar"
                    />
                    <div className="community-user-profile-content">
                      <h2 className="community-user-profile-name">{focusedUserProfile.name}</h2>
                      <div className="community-user-profile-stats-row">
                        <span className="community-user-profile-followers">
                          {Number(focusedUserProfile.followersCount) || 0} người theo dõi
                        </span>
                        {(focusedUserProfile.postsCount != null
                          ? focusedUserProfile.postsCount
                          : posts.length) > 0 && (
                          <span className="community-user-profile-followers">
                            · {focusedUserProfile.postsCount != null ? focusedUserProfile.postsCount : posts.length} bài viết
                          </span>
                        )}
                      </div>
                    </div>
                    {String(focusedUserProfile._id) !== String(currentUserId) && (
                      <button
                        type="button"
                        className={`search-user-follow-btn${followingIds.has(String(focusedUserProfile._id)) ? ' following' : ''}`}
                        onClick={(event) => handleToggleFollow(event, focusedUserProfile._id)}
                        disabled={followActionUserId === String(focusedUserProfile._id)}
                      >
                        {followActionUserId === String(focusedUserProfile._id)
                          ? 'Đang xử lý'
                          : followingIds.has(String(focusedUserProfile._id))
                            ? 'Đang theo dõi'
                            : 'Theo dõi'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="community-user-profile-loading">Không tìm thấy người dùng.</p>
              )}
            </div>
          )}
          {focusedUserId && (
            <button className="mobile-sort-bar" onClick={() => setMobileSortOpen(true)}>
              <span>{focusedUserSort === 'most-liked' ? 'Nhiều like nhất' : 'Mới nhất'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
            </button>
          )}

          {focusedSearch && (
            <>
              <div className="active-filter-banner search-banner">
                <span>Kết quả tìm kiếm: <strong>&ldquo;{focusedSearch}&rdquo;</strong></span>
                <button onClick={() => navigate('/community')} className="clear-filter-btn">✕ Quay lại bảng tin</button>
              </div>
              <div className="mobile-search-filter-tabs">
                {[
                  { label: 'Tất cả', value: 'all' },
                  { label: 'Mọi người', value: 'users' },
                  { label: 'Bài viết', value: 'posts' },
                  { label: 'Quán ăn', value: 'review' },
                ].map((f) => (
                  <button key={f.value} className={`mobile-search-filter-tab${searchFilter === f.value ? ' active' : ''}`} onClick={() => setSearchFilter(f.value)}>{f.label}</button>
                ))}
              </div>
            </>
          )}
          {focusedSearch && searchRestaurantResults.length > 0 && (
            <div className="search-user-results">
              <p className="search-user-results-title">Quán ăn</p>
              <div className="search-user-grid">
                {searchRestaurantResults.map((r) => (
                  <div
                    key={r.name}
                    className="search-user-card"
                    onClick={() => navigate(`/community?restaurant=${encodeURIComponent(r.name)}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/community?restaurant=${encodeURIComponent(r.name)}`); } }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="search-restaurant-icon">🍽️</div>
                    <div className="search-user-content">
                      <span className="search-user-name">{r.name}</span>
                      {r.location && <span className="search-user-stats">Đ/c: {r.location}</span>}
                      <span className="search-user-stats">
                        {r.avgRating !== null && (
                          <span className="restaurant-profile-stars">
                            {'★'.repeat(Math.round(r.avgRating))}{'☆'.repeat(5 - Math.round(r.avgRating))}
                          </span>
                        )}
                        {' '}{r.avgRating !== null ? `${r.avgRating}/5 · ` : ''}{r.reviewCount} đánh giá
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {focusedSearch && searchUserResults.length > 0 && (
            <div className="search-user-results">
              <p className="search-user-results-title">Mọi người</p>
              <div className="search-user-grid">
                {searchUserResults.map((u) => (
                  <div
                    key={u._id}
                    className="search-user-card"
                    onClick={() => handleSearchUserClick(u._id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSearchUserClick(u._id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <img
                      src={getAvatarUrl(u.avatar, url, u.name, 56)}
                      alt={u.name}
                      className="search-user-avatar"
                    />
                    <div className="search-user-content">
                      <span className="search-user-name">{u.name}</span>
                      <span className="search-user-stats">{u.followersCount} người theo dõi</span>
                      <span className="search-user-stats">{u.postsCount} bài viết</span>
                    </div>
                    {token && String(u._id) !== String(currentUserId) && (
                      <button
                        type="button"
                        className={`search-user-follow-btn${followingIds.has(String(u._id)) ? ' following' : ''}`}
                        onClick={(event) => handleToggleFollow(event, u._id)}
                        disabled={followActionUserId === String(u._id)}
                      >
                        {followActionUserId === String(u._id)
                          ? 'Đang xử lý'
                          : followingIds.has(String(u._id))
                            ? 'Đang theo dõi'
                            : 'Theo dõi'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {focusedPostId && (
            <div className="active-filter-banner">
              <span>Đang hiển thị bài viết từ thông báo</span>
              <button onClick={() => navigate('/community')} className="clear-filter-btn">✕ Quay lại bảng tin</button>
            </div>
          )}
          {selectedHashtag && (
            <div className="active-filter-banner">
              <span>Hiển thị bài viết với hashtag: <strong>#{selectedHashtag}</strong></span>
              <button onClick={() => setSelectedHashtag(null)} className="clear-filter-btn">✕ Xóa lọc</button>
            </div>
          )}
          {!focusedPostId && !focusedUserId && !focusedSearch && !focusedRestaurant && (
            <div className="create-post-row">
              <CreatePost
                key={filterType}
                onPostCreated={handlePostCreated}
                currentUserAvatar={getAvatarUrl(currentUser?.avatar, url, currentUser?.name || 'User', 80)}
                currentUserName={currentUser?.name || 'User'}
              />
              <button
                className="mobile-filter-toggle-btn"
                onClick={() => { setMobileFilterTemp(filterType); setMobileFilterOpen(true); }}
                aria-label="Mở bộ lọc"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {filterType !== 'all' && <span className="mobile-filter-dot" />}
              </button>
            </div>
          )}

          {loading ? (
            <div className="no-posts">
              <p>Đang tải bài viết...</p>
            </div>
          ) : shouldShowNoPosts ? (
            <div className="no-posts">
              <p>Không có bài viết liên quan.</p>
            </div>
          ) : (!searchUsersOnly || focusedRestaurant || focusedUserId) ? (
            posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onViewRecipe={handleViewRecipe}
                onLikePost={handleLikePost}
                onCommentPost={handleCommentPost}
                currentUserId={currentUserId}
                onPostChanged={fetchPosts}
                showAuthorFollowButton={!focusedUserId && !focusedRestaurant}
              />
            ))
          ) : searchRestaurantResults.length === 0 && searchUserResults.length === 0 ? (
            <div className="no-posts">
              <p>Không tìm thấy kết quả phù hợp.</p>
            </div>
          ) : null}
        </div>
        {!focusedPostId && !focusedUserId && !focusedSearch && !focusedRestaurant && (
          <TrendingTopics onHashtagClick={handleHashtagClick} selectedHashtag={selectedHashtag} />
        )}
      </div>
      
      {selectedRecipe && (
        <RecipeDetailModal 
          recipe={selectedRecipe} 
          onClose={() => setSelectedRecipe(null)} 
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingUnfollowUserId)}
        title="Bạn có chắc không?"
        message="Bạn có chắc chắn muốn hủy theo dõi người dùng này không?"
        cancelText="Hủy"
        confirmText="Hủy theo dõi"
        onClose={() => setPendingUnfollowUserId(null)}
        onConfirm={handleConfirmUnfollow}
      />

      {mobileFilterOpen && (
        <div className="mobile-filter-overlay" onClick={() => setMobileFilterOpen(false)}>
          <div className="mobile-filter-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-filter-header">
              <span className="mobile-filter-title">Bộ lọc</span>
              <button className="mobile-filter-close" onClick={() => setMobileFilterOpen(false)} aria-label="Đóng">✕</button>
            </div>
            <div className="mobile-filter-list">
              {[
                { label: 'Tất cả', value: 'all' },
                ...(token ? [
                  { label: 'Bài viết của tôi', value: 'my-posts' },
                  { label: 'Người theo dõi', value: 'following-posts' },
                ] : []),
                { label: 'Chia sẻ cảm nghĩ', value: 'normal' },
                { label: 'Hỏi đáp dinh dưỡng', value: 'nutrition-qa' },
                { label: 'Review quán chay', value: 'review' },
                ...(token ? [{ label: 'Đã thích', value: 'liked-posts' }] : []),
              ].map((f) => (
                <button
                  key={f.value}
                  className={`mobile-filter-option${mobileFilterTemp === f.value ? ' active' : ''}`}
                  onClick={() => setMobileFilterTemp(f.value)}
                >
                  {f.label}
                  {mobileFilterTemp === f.value && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <button
              className="mobile-filter-confirm"
              onClick={() => { handleFilterChange(mobileFilterTemp); setMobileFilterOpen(false); }}
            >
              Xác nhận
            </button>
          </div>
        </div>
      )}

      {mobileSortOpen && (
        <div className="mobile-filter-overlay" onClick={() => setMobileSortOpen(false)}>
          <div className="mobile-filter-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-filter-header">
              <span className="mobile-filter-title">Sắp xếp</span>
              <button className="mobile-filter-close" onClick={() => setMobileSortOpen(false)} aria-label="Đóng">✕</button>
            </div>
            <div className="mobile-filter-list">
              {[
                { label: 'Mới nhất', value: 'newest', desc: 'Hiển thị bài viết mới nhất trước' },
                { label: 'Nhiều like nhất', value: 'most-liked', desc: 'Hiển thị bài viết được thích nhiều nhất trước' },
              ].map((opt) => {
                const currentSort = focusedUserId ? focusedUserSort : restaurantSort;
                const isActive = currentSort === opt.value;
                return (
                  <button
                    key={opt.value}
                    className={`mobile-sort-option${isActive ? ' active' : ''}`}
                    onClick={() => {
                      if (focusedUserId) setFocusedUserSort(opt.value);
                      else setRestaurantSort(opt.value);
                      setMobileSortOpen(false);
                    }}
                  >
                    <div className="mobile-sort-option-text">
                      <span className="mobile-sort-option-label">{opt.label}</span>
                      <span className="mobile-sort-option-desc">{opt.desc}</span>
                    </div>
                    <div className={`mobile-sort-radio${isActive ? ' active' : ''}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Community;
