import { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import './CreatePost.css';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const CreatePost = ({ onPostCreated }) => {
  const { url, token } = useContext(StoreContext);
  const [postType, setPostType] = useState('normal');
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Recipe fields
  const [recipeData, setRecipeData] = useState({
    title: '',
    ingredients: [{ name: '', amount: '' }],
    instructions: [''],
    cookingTime: '',
    servings: '',
    difficulty: 'easy',
    category: '',
    nutrition: {
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      fiber: ''
    }
  });

  // Review fields
  const [reviewData, setReviewData] = useState({
    restaurantName: '',
    location: '',
    rating: 5
  });

  const postTypes = [
    { value: 'normal', label: 'Chia sẻ cảm nghĩ', icon: '📝' },
    { value: 'recipe', label: 'Công thức nấu ăn', icon: '👨‍🍳' },
    { value: 'nutrition-qa', label: 'Hỏi đáp dinh dưỡng', icon: '❓' },
    { value: 'review', label: 'Review quán chay', icon: '⭐' }
  ];

  const handleAddIngredient = () => {
    setRecipeData({
      ...recipeData,
      ingredients: [...recipeData.ingredients, { name: '', amount: '' }]
    });
  };

  const handleRemoveIngredient = (index) => {
    const newIngredients = recipeData.ingredients.filter((_, i) => i !== index);
    setRecipeData({ ...recipeData, ingredients: newIngredients });
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...recipeData.ingredients];
    newIngredients[index][field] = value;
    setRecipeData({ ...recipeData, ingredients: newIngredients });
  };

  const handleAddInstruction = () => {
    setRecipeData({
      ...recipeData,
      instructions: [...recipeData.instructions, '']
    });
  };

  const handleRemoveInstruction = (index) => {
    const newInstructions = recipeData.instructions.filter((_, i) => i !== index);
    setRecipeData({ ...recipeData, instructions: newInstructions });
  };

  const handleInstructionChange = (index, value) => {
    const newInstructions = [...recipeData.instructions];
    newInstructions[index] = value;
    setRecipeData({ ...recipeData, instructions: newInstructions });
  };

  const handleShare = async () => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để đăng bài!');
      return;
    }

    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung bài viết!');
      return;
    }

    // Validate recipe data
    if (postType === 'recipe') {
      if (!recipeData.title || !recipeData.ingredients.length || !recipeData.instructions.length) {
        toast.error('Vui lòng điền đầy đủ thông tin công thức!');
        return;
      }
    }

    // Validate review data
    if (postType === 'review') {
      if (!reviewData.restaurantName || !reviewData.location) {
        toast.error('Vui lòng điền đầy đủ thông tin quán!');
        return;
      }
    }

    try {
      // Extract hashtags from content (words starting with #)
      const hashtagRegex = /#\w+/g;
      const hashtagArray = (content.match(hashtagRegex) || []).map(tag => tag.substring(1));

      const postData = {
        type: postType,
        content,
        hashtags: hashtagArray,
        ...(postType === 'recipe' && { recipeData }),
        ...(postType === 'review' && { reviewData })
      };

      const response = await axios.post(
        `${url}/api/posts/create`,
        postData,
        { headers: { token } }
      );

      if (response.data.success) {
        toast.success('Đăng bài thành công!');
        // Reset form
        setContent('');
        setIsExpanded(false);
        setRecipeData({
          title: '',
          ingredients: [{ name: '', amount: '' }],
          instructions: [''],
          cookingTime: '',
          servings: '',
          difficulty: 'easy',
          category: '',
          nutrition: {
            calories: '',
            protein: '',
            carbs: '',
            fat: '',
            fiber: ''
          }
        });
        setReviewData({
          restaurantName: '',
          location: '',
          rating: 5
        });
        
        if (onPostCreated) {
          onPostCreated();
        }
      } else {
        toast.error(response.data.message || 'Có lỗi xảy ra!');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Không thể đăng bài. Vui lòng thử lại!');
    }
  };

  return (
    <div className="create-post">
      <div className="create-post-header">
        <img 
          src="https://ui-avatars.com/api/?name=User&background=10b981&color=fff" 
          alt="User" 
          className="create-post-avatar"
        />
        <input
          type="text"
          placeholder="Hôm nay bạn ăn gì? Chia sẻ nhé..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          className="create-post-input"
        />
      </div>

      {isExpanded && (
        <div className="create-post-expanded">
          {/* Post Type Tabs */}
          <div className="post-type-tabs">
            {postTypes.map((type) => (
              <button
                key={type.value}
                className={`post-type-tab ${postType === type.value ? 'active' : ''}`}
                onClick={() => setPostType(type.value)}
              >
                <span className="tab-icon">{type.icon}</span>
                <span className="tab-label">{type.label}</span>
              </button>
            ))}
          </div>

          {/* Recipe Form */}
          {postType === 'recipe' && (
            <div className="recipe-form">
              <div className="form-group">
                <label>Tên món ăn *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Phở chay"
                  value={recipeData.title}
                  onChange={(e) => setRecipeData({ ...recipeData, title: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Thời gian nấu (phút)</label>
                  <input
                    type="number"
                    placeholder="30"
                    value={recipeData.cookingTime}
                    onChange={(e) => setRecipeData({ ...recipeData, cookingTime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Số khẩu phần</label>
                  <input
                    type="number"
                    placeholder="2"
                    value={recipeData.servings}
                    onChange={(e) => setRecipeData({ ...recipeData, servings: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Độ khó</label>
                  <select
                    value={recipeData.difficulty}
                    onChange={(e) => setRecipeData({ ...recipeData, difficulty: e.target.value })}
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Nguyên liệu *</label>
                {recipeData.ingredients.map((ingredient, index) => (
                  <div key={index} className="ingredient-row">
                    <input
                      type="text"
                      placeholder="Tên nguyên liệu"
                      value={ingredient.name}
                      onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Khối lượng"
                      value={ingredient.amount}
                      onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                    />
                    {recipeData.ingredients.length > 1 && (
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveIngredient(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button className="add-btn" onClick={handleAddIngredient}>
                  + Thêm nguyên liệu
                </button>
              </div>

              <div className="form-group">
                <label>Các bước thực hiện *</label>
                {recipeData.instructions.map((instruction, index) => (
                  <div key={index} className="instruction-row">
                    <span className="step-number">Bước {index + 1}</span>
                    <textarea
                      placeholder="Mô tả bước thực hiện..."
                      value={instruction}
                      onChange={(e) => handleInstructionChange(index, e.target.value)}
                    />
                    {recipeData.instructions.length > 1 && (
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveInstruction(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button className="add-btn" onClick={handleAddInstruction}>
                  + Thêm bước
                </button>
              </div>
            </div>
          )}

          {/* Review Form */}
          {postType === 'review' && (
            <div className="review-form">
              <div className="form-group">
                <label>Tên quán *</label>
                <input
                  type="text"
                  placeholder="Tên quán ăn chay"
                  value={reviewData.restaurantName}
                  onChange={(e) => setReviewData({ ...reviewData, restaurantName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Địa chỉ *</label>
                <input
                  type="text"
                  placeholder="Địa chỉ quán"
                  value={reviewData.location}
                  onChange={(e) => setReviewData({ ...reviewData, location: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Đánh giá</label>
                <div className="rating-input">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`star ${star <= reviewData.rating ? 'filled' : ''}`}
                      onClick={() => setReviewData({ ...reviewData, rating: star })}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="create-post-actions">
            <button className="cancel-btn" onClick={() => setIsExpanded(false)}>
              Hủy
            </button>
            <button className="share-btn" onClick={handleShare}>
              Đăng bài
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

CreatePost.propTypes = {
  onPostCreated: PropTypes.func
};

export default CreatePost;
