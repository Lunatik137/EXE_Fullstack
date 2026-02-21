import { useState, useEffect, useContext } from "react";
import "./PostCard.css";
import PropTypes from "prop-types";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";

const PostCard = ({ post, onViewRecipe, onLikePost, onCommentPost }) => {
  const { url, token } = useContext(StoreContext);
  const [showFullContent, setShowFullContent] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [comments, setComments] = useState([]);
  const [showAllComments, setShowAllComments] = useState(false);

  const maxLength = 150;
  const shouldTruncate = post.content.length > maxLength;
  const displayContent =
    shouldTruncate && !showFullContent
      ? post.content.slice(0, maxLength) + "..."
      : post.content;

  // Check if current user has liked this post
  useEffect(() => {
    const checkLikedStatus = async () => {
      if (!token || !post.id) return;
      
      try {
        const response = await axios.get(`${url}/api/posts/${post.id}`, {
          headers: { token }
        });
        if (response.data.success) {
          setIsLiked(response.data.isLiked || false);
        }
      } catch (error) {
        console.error('Error checking liked status:', error);
      }
    };
    
    checkLikedStatus();
  }, [post.id, token, url]);

  // Fetch comments when component mounts or when post changes
  useEffect(() => {
    if (post.commentsData && post.commentsData.length > 0) {
      setComments(post.commentsData);
    }
  }, [post.commentsData]);

  const handleLike = async () => {
    if (isLiking) return;
    
    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
    
    setIsLiking(true);
    try {
      await onLikePost(post.id);
    } catch (error) {
      // Revert on error
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
    setIsLiking(false);
  };

  const handleCommentSubmit = async () => {
    if (isCommenting || !commentText.trim()) return;
    
    setIsCommenting(true);
    const success = await onCommentPost(post.id, commentText);
    if (success) {
      setCommentText('');
      // Refresh comments after posting
      fetchComments();
    }
    setIsCommenting(false);
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${url}/api/posts/${post.id}`);
      if (response.data.success && response.data.post.comments) {
        setComments(response.data.post.comments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const displayedComments = showAllComments ? comments : comments.slice(0, 2);
  const hasMoreComments = comments.length > 2;

  return (
    <div className="post-card">
      <div className="post-header">
        <img src={post.avatar} alt={post.author} className="post-avatar" />
        <div className="post-author-info">
          <h4 className="post-author">
            {post.author}
            {post.verified && <span className="verified-badge">✓</span>}
          </h4>
          <span className="post-time">{post.time}</span>
        </div>
      </div>

      <p className="post-content">
        {displayContent}
        {shouldTruncate && (
          <button
            className="read-more-btn"
            onClick={() => setShowFullContent(!showFullContent)}
          >
            {showFullContent ? " Thu gọn" : " Xem thêm"}
          </button>
        )}
      </p>

      {post.image && (
        <div className="post-image-container">
          <img src={post.image} alt="Post" className="post-image" />
        </div>
      )}

      <div className="post-footer">
        <div className="post-stats">
          <button 
            className={`stat-btn like-btn ${isLiked ? 'liked' : ''} ${isLiking ? 'disabled' : ''}`}
            onClick={handleLike}
            disabled={isLiking}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={isLiked ? "#ef4444" : "none"}
              stroke={isLiked ? "#ef4444" : "currentColor"}
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{likeCount}</span>
          </button>
          <button 
            className="stat-btn comment-btn"
            onClick={() => setShowCommentInput(!showCommentInput)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{post.comments || 0}</span>
          </button>
          <button className="post-save-btn">
            <svg
              width="20"
              height="20"
              viewBox="0 0 256 256"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M64 40h128a16 16 0 0 1 16 16v160l-80-48-80 48V56a16 16 0 0 1 16-16z" />
            </svg>
          </button>
        </div>
        {post.hasRecipe && (
          <button
            className="view-recipe-btn"
            onClick={() => onViewRecipe(post)}
          >
            Xem công thức gốc
          </button>
        )}
      </div>

      {/* Comments Section */}
      {comments.length > 0 && (
        <div className="comments-section">
          {displayedComments.map((comment, index) => (
            <div key={index} className="comment-item">
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userId?.name || 'User')}&background=10b981&color=fff`}
                alt={comment.userId?.name || 'User'} 
                className="comment-avatar" 
              />
              <div className="comment-content">
                <div className="comment-author">{comment.userId?.name || 'Người dùng'}</div>
                <div className="comment-text">{comment.content}</div>
              </div>
            </div>
          ))}
          {hasMoreComments && !showAllComments && (
            <button 
              className="view-more-comments-btn"
              onClick={() => setShowAllComments(true)}
            >
              Xem thêm {comments.length - 2} bình luận khác
            </button>
          )}
          {showAllComments && hasMoreComments && (
            <button 
              className="view-more-comments-btn"
              onClick={() => setShowAllComments(false)}
            >
              Ẩn bớt bình luận
            </button>
          )}
        </div>
      )}

      {showCommentInput && (
        <div className="comment-input-section">
          <input
            type="text"
            placeholder="Viết bình luận..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit()}
            className="comment-input"
          />
          <button 
            onClick={handleCommentSubmit}
            disabled={isCommenting || !commentText.trim()}
            className="comment-submit-btn"
          >
            {isCommenting ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
      )}
    </div>
  );
};

PostCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    author: PropTypes.string.isRequired,
    avatar: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    image: PropTypes.string,
    hasRecipe: PropTypes.bool,
    verified: PropTypes.bool,
    likes: PropTypes.number,
    likesArray: PropTypes.array,
    comments: PropTypes.number,
    commentsData: PropTypes.array,
    recipe: PropTypes.object,
    type: PropTypes.string,
    hashtags: PropTypes.array,
  }).isRequired,
  onViewRecipe: PropTypes.func,
  onLikePost: PropTypes.func.isRequired,
  onCommentPost: PropTypes.func.isRequired,
};

export default PostCard;
