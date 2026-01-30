import { useState } from 'react';
import './CreatePost.css';

const CreatePost = () => {
  const [postContent, setPostContent] = useState('');

  const handleShare = () => {
    if (postContent.trim()) {
      console.log('Sharing post:', postContent);
      setPostContent('');
      // Add API call to create post here
    }
  };

  return (
    <div className="create-post">
      <div className="create-post-header">
        <img 
          src="https://ui-avatars.com/api/?name=Trang+Nguyen&background=10b981&color=fff" 
          alt="User" 
          className="create-post-avatar"
        />
        <input
          type="text"
          placeholder="Hôm nay bạn ăn gì? Chia sẻ nhé..."
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          className="create-post-input"
        />
        <button className="share-icon-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CreatePost;
