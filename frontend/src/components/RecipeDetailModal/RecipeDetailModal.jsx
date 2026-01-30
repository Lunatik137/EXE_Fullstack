import { useState } from 'react';
import './RecipeDetailModal.css';
import PropTypes from 'prop-types';

const RecipeDetailModal = ({ recipe, onClose }) => {
  const [activeTab, setActiveTab] = useState('recipe');

  if (!recipe) return null;

  return (
    <div className="recipe-modal-overlay" onClick={onClose}>
      <div className="recipe-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>×</button>
        
        <div className="recipe-modal-content">
          {/* Left side - Image and ingredients */}
          <div className="recipe-left">
            <img src={recipe.image} alt={recipe.title} className="recipe-main-image" />
            
            <div className="recipe-info-box">
              <h3>Nguyên Liệu</h3>
              <div className="recipe-meta">
                <span>👥 {recipe.servings || '2 người'}</span>
                <span>⏱️ {recipe.cookTime || '30 phút'}</span>
              </div>
              <div className="ingredients-list">
                {recipe.ingredients?.map((ingredient, index) => (
                  <div key={index} className="ingredient-item">
                    <span className="ingredient-amount">{ingredient.amount}</span>
                    <span className="ingredient-name">{ingredient.name}</span>
                  </div>
                ))}
              </div>
              <p className="ingredients-note">
                Giá vị: {recipe.seasonings || 'muối, bột ngọt, hành lá, ngò rí, tiêu'}
              </p>
            </div>
          </div>

          {/* Right side - Instructions and comments */}
          <div className="recipe-right">
            <div className="recipe-header">
              <div className="recipe-tabs">
                <button 
                  className={`recipe-tab ${activeTab === 'recipe' ? 'active' : ''}`}
                  onClick={() => setActiveTab('recipe')}
                >
                  Đăng nhập
                </button>
                <button className="add-review-btn">+ Viết món mới</button>
              </div>
              
              <h1 className="recipe-title">{recipe.title}</h1>
              <div className="recipe-author">
                <img src={recipe.authorAvatar} alt={recipe.author} />
                <div>
                  <p className="author-name">
                    {recipe.author} <span className="author-handle">@{recipe.authorHandle}</span>
                  </p>
                  <p className="author-location">📍 {recipe.location || 'Nha Trang'}</p>
                </div>
              </div>
              <p className="recipe-description">{recipe.description}</p>
            </div>

            <div className="recipe-steps">
              <h3>Hướng dẫn cách làm</h3>
              <div className="recipe-duration">⏱️ {recipe.cookTime || '30 phút'}</div>
              
              {recipe.steps?.map((step, index) => (
                <div key={index} className="recipe-step">
                  <div className="step-number">{index + 1}</div>
                  <div className="step-content">
                    <p className="step-text">{step.text}</p>
                    {step.images && (
                      <div className="step-images">
                        {step.images.map((img, imgIndex) => (
                          <img key={imgIndex} src={img} alt={`Step ${index + 1}`} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="recipe-actions">
              <button className="action-btn save-btn">
                <span>📌</span> Lưu Món
              </button>
              <button className="action-btn share-btn">
                <span>🔗</span> Chia sẻ
              </button>
              <button className="action-btn print-btn">
                <span>🖨️</span> In
              </button>
            </div>

            <div className="recipe-footer">
              <p className="cooksnap-promo">
                Bạn đã làm theo món này phải không? Hãy chia sẻ hình ảnh bạn đã nấu nhé!
              </p>
              <button className="cooksnap-btn">Gửi Cooksnap</button>
            </div>

            <div className="comments-section">
              <h3>Bình luận</h3>
              {recipe.comments?.map((comment, index) => (
                <div key={index} className="comment-item">
                  <img src={comment.avatar} alt={comment.author} className="comment-avatar" />
                  <div className="comment-content">
                    <p className="comment-author">{comment.author}</p>
                    <p className="comment-time">{comment.time}</p>
                    <p className="comment-text">{comment.text}</p>
                    <button className="comment-reply">Kết bạn</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

RecipeDetailModal.propTypes = {
  recipe: PropTypes.shape({
    title: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    author: PropTypes.string.isRequired,
    authorAvatar: PropTypes.string.isRequired,
    authorHandle: PropTypes.string,
    location: PropTypes.string,
    description: PropTypes.string,
    servings: PropTypes.string,
    cookTime: PropTypes.string,
    seasonings: PropTypes.string,
    ingredients: PropTypes.arrayOf(PropTypes.shape({
      amount: PropTypes.string,
      name: PropTypes.string
    })),
    steps: PropTypes.arrayOf(PropTypes.shape({
      text: PropTypes.string,
      images: PropTypes.arrayOf(PropTypes.string)
    })),
    comments: PropTypes.arrayOf(PropTypes.shape({
      author: PropTypes.string,
      avatar: PropTypes.string,
      time: PropTypes.string,
      text: PropTypes.string
    }))
  }),
  onClose: PropTypes.func.isRequired
};

export default RecipeDetailModal;
