import { useState, useContext, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './CreatePost.css';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const CreatePost = ({ onPostCreated, currentUserAvatar, currentUserName }) => {
  const { url, token } = useContext(StoreContext);
  const [postType, setPostType] = useState('normal');
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  
  // ...existing code...

  // Review fields
  const [reviewData, setReviewData] = useState({
    restaurantName: '',
    location: '',
    rating: 5
  });
  const [restaurantSuggestions, setRestaurantSuggestions] = useState([]);
  const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const restaurantInputRef = useRef(null);
  const restaurantDropdownRef = useRef(null);
  const modalContentRef = useRef(null);

  const postTypes = [
    { value: 'normal', label: 'Chia sẻ cảm nghĩ', icon: '📝' },
    { value: 'nutrition-qa', label: 'Hỏi đáp dinh dưỡng', icon: '❓' },
    { value: 'review', label: 'Review quán chay', icon: '⭐' }
  ];

  // ...existing code...

  useEffect(() => {
    if (!isExpanded) return;

    const scrollY = window.scrollY;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      const storedY = Math.abs(parseInt(document.body.style.top || '0', 10));
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      window.scrollTo(0, Number.isNaN(storedY) ? scrollY : storedY);
    };
  }, [isExpanded]);

  // Calc fixed position of dropdown relative to viewport
  const calcDropdownPos = () => {
    if (restaurantInputRef.current) {
      const rect = restaurantInputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  };

  // Debounced restaurant name search
  useEffect(() => {
    const trimmed = reviewData.restaurantName.trim();
    if (!trimmed) {
      setRestaurantSuggestions([]);
      setShowRestaurantDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${url}/api/posts/restaurants/suggest`, {
          params: { q: trimmed }
        });
        if (res.data.success) {
          setRestaurantSuggestions(res.data.restaurants);
          if (res.data.restaurants.length > 0) {
            calcDropdownPos();
            setShowRestaurantDropdown(true);
          } else {
            setShowRestaurantDropdown(false);
          }
        }
      } catch {
        // silently ignore suggestion errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [reviewData.restaurantName, url]);

  // Close dropdown when modal content is scrolled
  useEffect(() => {
    const el = modalContentRef.current;
    if (!el) return;
    const onScroll = () => setShowRestaurantDropdown(false);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [isExpanded]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        restaurantInputRef.current &&
        !restaurantInputRef.current.contains(e.target) &&
        restaurantDropdownRef.current &&
        !restaurantDropdownRef.current.contains(e.target)
      ) {
        setShowRestaurantDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectRestaurant = (suggestion) => {
    setReviewData({ ...reviewData, restaurantName: suggestion.restaurantName, location: suggestion.location || reviewData.location });
    setShowRestaurantDropdown(false);
  };

  const handleOpenModal = () => {
    setIsExpanded(true);
  };

  const handleCloseModal = () => {
    setIsExpanded(false);
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedImages.length > 5) {
      toast.error('Chỉ được tải tối đa 5 ảnh!');
      return;
    }
    setSelectedImages([...selectedImages, ...files]);
  };

  const handleRemoveImage = (index) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
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

    // ...existing code...

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

      const formData = new FormData();
      formData.append('type', postType);
      formData.append('content', content);
      formData.append('hashtags', JSON.stringify(hashtagArray));
      
      // ...existing code...
      if (postType === 'review') {
        formData.append('reviewData', JSON.stringify(reviewData));
      }
      
      selectedImages.forEach((image) => {
        formData.append('images', image);
      });

      const response = await axios.post(
        `${url}/api/posts/create`,
        formData,
        { 
          headers: { 
            token
          } 
        }
      );

      if (response.data.success) {
        toast.success('Đăng bài thành công!');
        // Reset form
        setContent('');
        setSelectedImages([]);
        setIsExpanded(false);
        setReviewData({
          restaurantName: '',
          location: '',
          rating: 5
        });
        setRestaurantSuggestions([]);
        setShowRestaurantDropdown(false);
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
          src={currentUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserName || 'User')}&background=10b981&color=fff`}
          alt={currentUserName || 'User'} 
          className="create-post-avatar"
        />
        <button type="button" onClick={handleOpenModal} className="create-post-input" aria-label="Mở form tạo bài viết">
          <span className="create-post-placeholder-full">{content.trim() ? content : 'Hôm nay bạn ăn gì? Chia sẻ nhé...'}</span>
          <span className="create-post-placeholder-short" aria-hidden="true">{content.trim() ? content : 'Bạn đang nghĩ gì?'}</span>
        </button>
      </div>

      {isExpanded && (
        <div className="create-post-modal-overlay" onClick={handleCloseModal}>
          <div className="create-post-modal" onClick={(event) => event.stopPropagation()}>
            <div className="create-post-modal-header">
              <h3>Tạo bài viết</h3>
              <button type="button" className="create-post-modal-close" onClick={handleCloseModal} aria-label="Đóng">
                ×
              </button>
            </div>

            <div className="create-post-modal-content" ref={modalContentRef}>
              <div className="create-post-modal-user">
                <img 
                  src={currentUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserName || 'User')}&background=10b981&color=fff`}
                  alt={currentUserName || 'User'} 
                  className="create-post-avatar"
                />
                <span className="create-post-modal-username">{currentUserName || 'User'}</span>
              </div>

              <textarea
                className="create-post-modal-textarea"
                placeholder="Bạn đang nghĩ gì thế?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

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

              {/* Review Form */}
              {postType === 'review' && (
                <div className="review-form">
                  <div className="form-group">
                    <label>Tên quán *</label>
                    <div className="restaurant-search-wrapper">
                      <input
                        ref={restaurantInputRef}
                        type="text"
                        placeholder="Tên quán ăn chay"
                        value={reviewData.restaurantName}
                        onChange={(e) => setReviewData({ ...reviewData, restaurantName: e.target.value })}
                        onFocus={() => {
                          if (restaurantSuggestions.length > 0) setShowRestaurantDropdown(true);
                        }}
                        autoComplete="off"
                      />
                      {showRestaurantDropdown && (
                        <ul
                          className="restaurant-dropdown"
                          ref={restaurantDropdownRef}
                          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                        >
                          {restaurantSuggestions.map((s, i) => (
                            <li
                              key={i}
                              className="restaurant-dropdown-item"
                              onMouseDown={() => handleSelectRestaurant(s)}
                            >
                              <span className="restaurant-dropdown-name">{s.restaurantName}</span>
                              {s.location && (
                                <span className="restaurant-dropdown-location">{s.location}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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

              {/* Image Upload Section */}
              <div className="image-upload-section">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                <label htmlFor="image-upload" className="upload-btn">
                  Thêm ảnh (tối đa 5)
                </label>
                
                {selectedImages.length > 0 && (
                  <div className="image-preview-grid">
                    {selectedImages.map((image, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={URL.createObjectURL(image)} alt={`Preview ${index}`} />
                        <button
                          className="remove-image-btn"
                          onClick={() => handleRemoveImage(index)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="create-post-actions">
                <button className="share-btn" onClick={handleShare}>
                  Đăng bài
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

CreatePost.propTypes = {
  onPostCreated: PropTypes.func,
  currentUserAvatar: PropTypes.string,
  currentUserName: PropTypes.string,
};

export default CreatePost;
