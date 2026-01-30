import { useState } from 'react';
import './PostCard.css';
import PropTypes from 'prop-types';

const PostCard = ({ post, onViewRecipe }) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const maxLength = 150;
  const shouldTruncate = post.content.length > maxLength;
  const displayContent = shouldTruncate && !showFullContent 
    ? post.content.slice(0, maxLength) + '...' 
    : post.content;

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
        <button className="post-share-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>

      <p className="post-content">
        {displayContent}
        {shouldTruncate && (
          <button 
            className="read-more-btn" 
            onClick={() => setShowFullContent(!showFullContent)}
          >
            {showFullContent ? ' Thu gọn' : ' Xem thêm'}
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
          <button className="stat-btn like-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>{post.likes || 0}</span>
          </button>
          <button className="stat-btn comment-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{post.comments || 0}</span>
          </button>
        </div>
        {post.hasRecipe && (
          <button className="view-recipe-btn" onClick={() => onViewRecipe(post)}>
            Xem công thức gốc
          </button>
        )}
      </div>
    </div>
  );
};

PostCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.number.isRequired,
    author: PropTypes.string.isRequired,
    avatar: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    image: PropTypes.string,
    hasRecipe: PropTypes.bool,
    verified: PropTypes.bool,
    likes: PropTypes.number,
    comments: PropTypes.number
  }).isRequired,
  onViewRecipe: PropTypes.func
};

export default PostCard;
