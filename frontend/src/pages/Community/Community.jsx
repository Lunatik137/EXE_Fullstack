import { useState, useContext, useEffect, useCallback } from 'react';
import './Community.css';
import FilterSidebar from '../../components/FilterSidebar/FilterSidebar';
import CreatePost from '../../components/CreatePost/CreatePost';
import PostCard from '../../components/PostCard/PostCard';
import TrendingTopics from '../../components/TrendingTopics/TrendingTopics';
import RecipeDetailModal from '../../components/RecipeDetailModal/RecipeDetailModal';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';

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

const transformPostData = (apiPost) => {
  return {
    id: apiPost._id,
    author: apiPost.userId?.name || 'Người dùng ẩn danh',
    avatar: apiPost.userId?.avatar || 'https://via.placeholder.com/50',
    time: formatTimeAgo(apiPost.createdAt),
    content: apiPost.content,
    image: apiPost.media?.[0] || null,
    hasRecipe: apiPost.type === 'recipe',
    verified: apiPost.userId?.verified || false,
    likes: apiPost.likes?.length || 0,
    likesArray: apiPost.likes || [],
    comments: apiPost.comments?.length || 0,
    commentsData: apiPost.comments || [],
    recipe: apiPost.recipeData || null,
    type: apiPost.type,
    hashtags: apiPost.hashtags || []
  };
};

const Community = () => {
  const { url, token } = useContext(StoreContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [selectedHashtag, setSelectedHashtag] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      let endpoint;
      
      if (selectedHashtag) {
        // Filter by hashtag (remove # if present)
        const hashtagValue = selectedHashtag.replace('#', '');
        endpoint = `${url}/api/posts/hashtag/${hashtagValue}`;
      } else if (filterType === 'all') {
        endpoint = `${url}/api/posts`;
      } else {
        endpoint = `${url}/api/posts/type/${filterType}`;
      }
      
      const response = await axios.get(endpoint);
      
      if (response.data.success) {
        const transformedPosts = response.data.posts.map(transformPostData);
        setPosts(transformedPosts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, [url, filterType, selectedHashtag]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) {
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
          setCurrentUserId(response.data.user?._id || null);
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
        setCurrentUserId(null);
      }
    };

    fetchCurrentUser();
  }, [token, url]);

  const handlePostCreated = () => {
    fetchPosts();
  };

  const handleHashtagClick = (hashtag) => {
    setSelectedHashtag(hashtag);
    setFilterType('all'); // Reset filter type when selecting hashtag
  };

  const handleFilterChange = (newFilterType) => {
    setFilterType(newFilterType);
    setSelectedHashtag(null); // Reset hashtag when changing filter type
  };

  const handleViewRecipe = (post) => {
    if (post.recipe) {
      setSelectedRecipe(post.recipe);
    }
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
        fetchPosts();
      }
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Không thể thích bài viết. Vui lòng thử lại.');
    }
  };

  const handleCommentPost = async (postId, comment) => {
    if (!token) {
      alert('Vui lòng đăng nhập để bình luận');
      return;
    }

    if (!comment.trim()) {
      alert('Vui lòng nhập nội dung bình luận');
      return;
    }

    try {
      const response = await axios.post(
        `${url}/api/posts/${postId}/comment`,
        { content: comment },
        { headers: { token } }
      );

      if (response.data.success) {
        fetchPosts();
        return true;
      }
    } catch (error) {
      console.error('Error commenting on post:', error);
      alert('Không thể bình luận. Vui lòng thử lại.');
      return false;
    }
  };

  return (
    <>
      <div className="community-page">
        <FilterSidebar onFilterChange={handleFilterChange} currentFilter={filterType} isOpen={sidebarOpen} />
        <div className="community-feed">
          {selectedHashtag && (
            <div className="active-filter-banner">
              <span>Hiển thị bài viết với hashtag: <strong>#{selectedHashtag}</strong></span>
              <button onClick={() => setSelectedHashtag(null)} className="clear-filter-btn">✕ Xóa lọc</button>
            </div>
          )}
          <CreatePost onPostCreated={handlePostCreated} />

          {loading ? (
            <div className="no-posts">
              <p>Đang tải bài viết...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="no-posts">
              <p>Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!</p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onViewRecipe={handleViewRecipe}
                onLikePost={handleLikePost}
                onCommentPost={handleCommentPost}
                currentUserId={currentUserId}
              />
            ))
          )}
        </div>
        <TrendingTopics onHashtagClick={handleHashtagClick} selectedHashtag={selectedHashtag} />
      </div>
      
      {selectedRecipe && (
        <RecipeDetailModal 
          recipe={selectedRecipe} 
          onClose={() => setSelectedRecipe(null)} 
        />
      )}
    </>
  );
};

export default Community;
