import { useState, useContext } from 'react';
import './Community.css';
import FilterSidebar from '../../components/FilterSidebar/FilterSidebar';
import CreatePost from '../../components/CreatePost/CreatePost';
import PostCard from '../../components/PostCard/PostCard';
import TrendingTopics from '../../components/TrendingTopics/TrendingTopics';
import RecipeDetailModal from '../../components/RecipeDetailModal/RecipeDetailModal';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';

/* TEMPORARILY COMMENTED OUT - Helper functions
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
*/

/* TEMPORARILY COMMENTED OUT
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
*/

const Community = () => {
  const { url, token } = useContext(StoreContext);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [selectedHashtag, setSelectedHashtag] = useState(null);

  // Hardcoded posts for testing
  const [posts] = useState([
    {
      id: 1,
      author: 'Minh Anh',
      avatar: 'https://ui-avatars.com/api/?name=Minh+Anh&background=10b981&color=fff',
      time: '2 giờ trước',
      content: 'Hôm nay mình đã thử làm món phở chay mới! Ngon tuyệt vời, ai muốn công thức không?',
      image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=500',
      hasRecipe: true,
      verified: true,
      likes: 124,
      likesArray: [],
      comments: 15,
      commentsData: [
        {
          userId: { name: 'Hoàng Nam' },
          content: 'Trông ngon quá! Cho mình xin công thức với ạ!'
        },
        {
          userId: { name: 'Thu Hà' },
          content: 'Phở này nhìn hấp dẫn thật! Mình cũng muốn thử làm.'
        }
      ],
      type: 'recipe',
      hashtags: ['phở chay', 'healthy'],
      recipe: {
        title: 'Phở chay',
        image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800',
        author: 'Minh Anh',
        authorAvatar: 'https://ui-avatars.com/api/?name=Minh+Anh&background=10b981&color=fff',
        authorHandle: 'minhanh',
        location: 'Nha Trang',
        ingredients: [
          { name: 'Bánh phở', amount: '200g' },
          { name: 'Nấm hương', amount: '100g' },
          { name: 'Rau thơm', amount: '50g' }
        ],
        instructions: [
          'Ngâm bánh phở trong nước ấm',
          'Nấu nước dùng từ nấm và gia vị',
          'Cho bánh phở vào tô, chan nước dùng'
        ],
        cookingTime: '30',
        servings: '2',
        difficulty: 'easy'
      }
    },
    {
      id: 2,
      author: 'Tuấn Kiệt',
      avatar: 'https://ui-avatars.com/api/?name=Tuan+Kiet&background=f59e0b&color=fff',
      time: '5 giờ trước',
      content: 'Mình vừa ăn chay được 1 tháng rồi, cảm thấy cơ thể nhẹ nhàng hơn hẳn. Các bạn có tips gì để duy trì không?',
      likes: 87,
      likesArray: [],
      comments: 23,
      commentsData: [
        {
          userId: { name: 'Mai Linh' },
          content: 'Tuyệt vời! Mình ăn chay được 6 tháng rồi, cảm thấy rất tốt!'
        }
      ],
      type: 'normal',
      hashtags: ['ăn chay', 'healthy lifestyle']
    },
    {
      id: 3,
      author: 'Lan Hương',
      avatar: 'https://ui-avatars.com/api/?name=Lan+Huong&background=ef4444&color=fff',
      time: '1 ngày trước',
      content: 'Review quán chay mới ở quận 1: Quán Chay Tịnh Tâm. Món ăn ngon, giá cả hợp lý, không gian thoáng mát. Nhất định sẽ quay lại!',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500',
      likes: 156,
      likesArray: [],
      comments: 8,
      commentsData: [],
      type: 'review',
      hashtags: ['review quán chay', 'quận 1']
    }
  ]);

  /* API FETCH - TEMPORARILY COMMENTED OUT
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
  */

  const handlePostCreated = () => {
    // fetchPosts(); // Commented out
    console.log('Post created - refresh disabled for hardcoded data');
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
        console.log('Post liked successfully');
        // Update disabled for hardcoded data
        // setPosts would update here in production
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
        console.log('Comment posted successfully');
        // Update disabled for hardcoded data
        // setPosts would update here in production
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
        <FilterSidebar onFilterChange={handleFilterChange} currentFilter={filterType} />
        <div className="community-feed">
          {selectedHashtag && (
            <div className="active-filter-banner">
              <span>Hiển thị bài viết với hashtag: <strong>#{selectedHashtag}</strong></span>
              <button onClick={() => setSelectedHashtag(null)} className="clear-filter-btn">✕ Xóa lọc</button>
            </div>
          )}
          <CreatePost onPostCreated={handlePostCreated} />
          
          {posts.length === 0 ? (
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
