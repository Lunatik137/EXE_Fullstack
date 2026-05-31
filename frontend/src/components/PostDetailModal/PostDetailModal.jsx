import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './PostDetailModal.css';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getAvatarUrl } from '../../utils/avatar';

const PostDetailModal = ({
  post,
  isOpen,
  onClose,
  currentUserId,
  onCommentsChanged,
  onLikeStateChanged,
}) => {
  const LIGHTBOX_ZOOM_LEVELS = [1, 1.2, 1.4, 1.6, 1.8, 2];
  const { url, token } = useContext(StoreContext);
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [activeMediaIndex, setActiveMediaIndex] = useState(null);
  const [lightboxZoomIndex, setLightboxZoomIndex] = useState(0);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isDraggingLightbox, setIsDraggingLightbox] = useState(false);
  const lightboxDragStartRef = useRef({ x: 0, y: 0 });
  const lightboxPanRafRef = useRef(null);
  const lightboxPanPendingRef = useRef({ x: 0, y: 0 });
  const lightboxPointerIdRef = useRef(null);

  const sortByNewest = (commentList = []) => {
    return [...commentList].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const handleUserClick = (userId) => {
    if (!userId) return;
    onClose();
    navigate(`/community?user=${userId}`);
  };

  useEffect(() => {
    if (!isOpen || !post?.id) return;
    fetchComments();
  }, [isOpen, post?.id]);

  useEffect(() => {
    const liked = Boolean(
      currentUserId
      && Array.isArray(post?.likesArray)
      && post.likesArray.some((id) => String(id) === String(currentUserId))
    );
    setIsLiked(liked);
    setLikeCount(post?.likes || 0);
  }, [currentUserId, post?.likes, post?.likesArray]);

  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      const storedY = Math.abs(parseInt(document.body.style.top || '0', 10));
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.scrollTo(0, Number.isNaN(storedY) ? scrollY : storedY);
    };
  }, [isOpen]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${url}/api/posts/${post.id}`);
      if (response.data.success && response.data.post?.comments) {
        const sortedComments = sortByNewest(response.data.post.comments);
        setComments(sortedComments);
        if (onCommentsChanged) onCommentsChanged(sortedComments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const commentDate = new Date(date);
    const diffInSeconds = Math.floor((now - commentDate) / 1000);

    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    return `${Math.floor(diffInSeconds / 604800)} tuần trước`;
  };

  const renderContentWithHashtags = (content) => {
    const parts = content.split(/(#[A-Za-z0-9_]+)/g);
    return parts.map((part, index) => (
      part.startsWith('#')
        ? <span key={`${part}-${index}`} className="hashtag">{part}</span>
        : <span key={`${part}-${index}`}>{part}</span>
    ));
  };

  const getCommentId = (comment) => comment?._id || comment?.id || '';

  const syncComments = (nextComments) => {
    const sortedComments = sortByNewest(nextComments || []);
    setComments(sortedComments);
    if (onCommentsChanged) onCommentsChanged(sortedComments);
  };

  const visibleMedia = (post.media || []).filter((item) => item?.url).slice(0, 5);
  const mediaCount = visibleMedia.length;
  const mediaUrls = visibleMedia.map((item) => `${url}/images/posts/${item.url}`);

  const openLightbox = (index) => {
    setActiveMediaIndex(index);
    setLightboxZoomIndex(0);
    setLightboxPan({ x: 0, y: 0 });
    setIsDraggingLightbox(false);
  };

  const closeLightbox = () => {
    setActiveMediaIndex(null);
    setLightboxZoomIndex(0);
    setLightboxPan({ x: 0, y: 0 });
    setIsDraggingLightbox(false);
  };

  const showPreviousImage = useCallback(() => {
    if (mediaUrls.length < 2 || activeMediaIndex === null) return;
    setActiveMediaIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);
    setLightboxZoomIndex(0);
    setLightboxPan({ x: 0, y: 0 });
    setIsDraggingLightbox(false);
  }, [activeMediaIndex, mediaUrls.length]);

  const showNextImage = useCallback(() => {
    if (mediaUrls.length < 2 || activeMediaIndex === null) return;
    setActiveMediaIndex((prev) => (prev + 1) % mediaUrls.length);
    setLightboxZoomIndex(0);
    setLightboxPan({ x: 0, y: 0 });
    setIsDraggingLightbox(false);
  }, [activeMediaIndex, mediaUrls.length]);

  const handleZoomIn = () => {
    setLightboxZoomIndex((prev) => Math.min(prev + 1, LIGHTBOX_ZOOM_LEVELS.length - 1));
  };

  const handleZoomOut = () => {
    setLightboxZoomIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next === 0) {
        setLightboxPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleLightboxImageMouseDown = (event) => {
    if (lightboxZoomIndex === 0) return;
    event.preventDefault();
    event.stopPropagation();

    lightboxPointerIdRef.current = event.pointerId;
    lightboxDragStartRef.current = {
      x: event.clientX - lightboxPan.x,
      y: event.clientY - lightboxPan.y,
    };
    setIsDraggingLightbox(true);
  };

  useEffect(() => {
    if (!isDraggingLightbox) return;

    const handlePointerMove = (event) => {
      if (lightboxPointerIdRef.current !== null && event.pointerId !== lightboxPointerIdRef.current) {
        return;
      }

      lightboxPanPendingRef.current = {
        x: event.clientX - lightboxDragStartRef.current.x,
        y: event.clientY - lightboxDragStartRef.current.y,
      };

      if (lightboxPanRafRef.current !== null) return;
      lightboxPanRafRef.current = window.requestAnimationFrame(() => {
        setLightboxPan(lightboxPanPendingRef.current);
        lightboxPanRafRef.current = null;
      });
    };

    const handlePointerUp = (event) => {
      if (lightboxPointerIdRef.current !== null && event.pointerId !== lightboxPointerIdRef.current) {
        return;
      }
      lightboxPointerIdRef.current = null;
      setIsDraggingLightbox(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (lightboxPanRafRef.current !== null) {
        window.cancelAnimationFrame(lightboxPanRafRef.current);
        lightboxPanRafRef.current = null;
      }
    };
  }, [isDraggingLightbox]);

  useEffect(() => {
    if (activeMediaIndex === null) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') showPreviousImage();
      if (event.key === 'ArrowRight') showNextImage();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMediaIndex, showPreviousImage, showNextImage]);

  const handleCommentSubmit = async () => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để bình luận');
      return;
    }

    if (!commentText.trim()) {
      toast.error('Vui lòng nhập nội dung bình luận');
      return;
    }

    setIsCommenting(true);
    try {
      const response = await axios.post(
        `${url}/api/posts/${post.id}/comment`,
        { content: commentText.trim() },
        { headers: { token } }
      );

      if (response.data.success) {
        setCommentText('');
        toast.success('Bình luận thành công');
        syncComments(response.data.comments);
      }
    } catch (error) {
      console.error('Error commenting:', error);
      toast.error('Không thể bình luận. Vui lòng thử lại.');
    } finally {
      setIsCommenting(false);
    }
  };

  const handleEditStart = (comment) => {
    setEditingCommentId(getCommentId(comment));
    setEditingCommentText(comment.content || '');
  };

  const handleEditSave = async (commentId) => {
    if (!editingCommentText.trim()) {
      toast.error('Nội dung bình luận không được để trống');
      return;
    }

    try {
      const response = await axios.put(
        `${url}/api/posts/${post.id}/comment/${commentId}`,
        { content: editingCommentText.trim() },
        { headers: { token } }
      );

      if (response.data.success) {
        setEditingCommentId(null);
        setEditingCommentText('');
        toast.success('Cập nhật bình luận thành công');
        syncComments(response.data.comments);
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Không thể cập nhật bình luận. Vui lòng thử lại.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const response = await axios.delete(
        `${url}/api/posts/${post.id}/comment/${commentId}`,
        { headers: { token } }
      );

      if (response.data.success) {
        setConfirmDeleteId(null);
        toast.success('Xóa bình luận thành công');
        syncComments(response.data.comments);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Không thể xóa bình luận. Vui lòng thử lại.');
    }
  };

  const handleLike = async () => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để thích bài viết');
      return;
    }
    if (isLiking) return;

    const previousLiked = isLiked;
    const previousCount = likeCount;
    const nextLiked = !previousLiked;
    const optimisticCount = previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1;

    setIsLiked(nextLiked);
    setLikeCount(optimisticCount);
    if (onLikeStateChanged) {
      onLikeStateChanged({ isLiked: nextLiked, likeCount: optimisticCount });
    }

    setIsLiking(true);
    try {
      const response = await axios.post(
        `${url}/api/posts/${post.id}/like`,
        {},
        { headers: { token } }
      );

      if (response.data.success) {
        const serverCount = Number(response.data.likesCount);
        if (!Number.isNaN(serverCount)) {
          setLikeCount(serverCount);
          if (onLikeStateChanged) {
            onLikeStateChanged({ isLiked: nextLiked, likeCount: serverCount });
          }
        }
      } else {
        setIsLiked(previousLiked);
        setLikeCount(previousCount);
        if (onLikeStateChanged) {
          onLikeStateChanged({ isLiked: previousLiked, likeCount: previousCount });
        }
      }
    } catch (error) {
      console.error('Error liking post in modal:', error);
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
      if (onLikeStateChanged) {
        onLikeStateChanged({ isLiked: previousLiked, likeCount: previousCount });
      }
      toast.error('Không thể thích bài viết. Vui lòng thử lại.');
    } finally {
      setIsLiking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="post-detail-modal-overlay" onClick={onClose}>
      <div className="post-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="post-detail-header">
          <span className="post-detail-header-spacer" aria-hidden="true" />
          <h2>Bài viết của {post.author ? (post.author.includes(' > ') ? post.author.split(' > ')[0] : post.author) : 'Người dùng'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="post-detail-content">
          <div className="post-detail-post">
            <div className="post-detail-header-info">
              <img
                src={post.avatar}
                alt={post.author}
                className={`post-detail-avatar${post.authorId ? ' post-detail-avatar-clickable' : ''}`}
                onClick={post.authorId ? () => handleUserClick(post.authorId) : undefined}
              />
              <div className="post-detail-author">
                <h4
                  className={post.authorId ? 'post-detail-author-link' : ''}
                  onClick={post.authorId ? () => handleUserClick(post.authorId) : undefined}
                >
                  {post.author}
                </h4>
                <span className="post-detail-time">{post.time}</span>
              </div>
            </div>
            <div className="post-detail-text">{renderContentWithHashtags(post.content || '')}</div>
            {mediaCount > 0 && (
              <div className={`post-media-grid count-${mediaCount}`}>
                {visibleMedia.map((item, index) => (
                  <div key={index} className="post-media-item">
                    <img
                      src={mediaUrls[index]}
                      alt={`Media ${index + 1}`}
                      onClick={() => openLightbox(index)}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="post-detail-stats">
              <button
                type="button"
                className={`post-detail-stat-btn post-detail-stat-item ${isLiked ? 'liked' : ''}`}
                onClick={handleLike}
                disabled={isLiking}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={isLiked ? '#ef4444' : 'none'}
                  stroke={isLiked ? '#ef4444' : 'currentColor'}
                  strokeWidth="2"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span>{likeCount}</span>
              </button>
              <div className="post-detail-stat-item">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>{comments.length}</span>
              </div>
            </div>
          </div>

          <div className="post-detail-comments">
            {comments.map((comment) => {
              const commentId = getCommentId(comment);
              const isCommentOwner = currentUserId
                && String(comment.userId?._id || comment.userId) === String(currentUserId);

              return (
                <div key={commentId} className="post-detail-comment-item">
                  <img
                    src={getAvatarUrl(comment.userId?.avatar, url, comment.userId?.name || 'User', 40)}
                    alt={comment.userId?.name || 'User'}
                    className={`post-detail-comment-avatar${comment.userId?._id ? ' post-detail-comment-avatar-clickable' : ''}`}
                    onClick={comment.userId?._id ? () => handleUserClick(comment.userId._id) : undefined}
                  />
                  <div className="post-detail-comment-content">
                    <div className="post-detail-comment-header">
                      <span
                        className={`post-detail-comment-author${comment.userId?._id ? ' post-detail-comment-author-link' : ''}`}
                        onClick={comment.userId?._id ? () => handleUserClick(comment.userId._id) : undefined}
                      >
                        {comment.userId?.name || 'Người dùng'}
                      </span>
                      <span className="post-detail-comment-time">{formatTimeAgo(comment.createdAt)}</span>
                    </div>

                    {editingCommentId === commentId ? (
                      <div className="post-detail-comment-edit">
                        <input
                          type="text"
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className="post-detail-comment-edit-input"
                        />
                        <div className="post-detail-comment-edit-actions">
                          <button
                            onClick={() => setEditingCommentId(null)}
                            className="post-detail-comment-action-btn"
                          >
                            Hủy
                          </button>
                          <button
                            onClick={() => handleEditSave(commentId)}
                            className="post-detail-comment-action-btn"
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="post-detail-comment-text">{comment.content}</div>
                    )}

                    {isCommentOwner && editingCommentId !== commentId && (
                      <button
                        className="post-detail-comment-menu-btn"
                        onClick={() => {
                          setOpenCommentMenuId(openCommentMenuId === commentId ? null : commentId);
                        }}
                      >
                        ⋯
                      </button>
                    )}

                    {openCommentMenuId === commentId && isCommentOwner && (
                      <div className="post-detail-comment-menu">
                        <button
                          onClick={() => {
                            handleEditStart(comment);
                            setOpenCommentMenuId(null);
                          }}
                          className="post-detail-comment-menu-item"
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDeleteId(commentId);
                            setOpenCommentMenuId(null);
                          }}
                          className="post-detail-comment-menu-item danger"
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="post-detail-comment-input-section">
            <input
              type="text"
              placeholder="Viết bình luận..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
              className="post-detail-comment-input"
            />
            <button
              onClick={handleCommentSubmit}
              disabled={isCommenting || !commentText.trim()}
              className="post-detail-comment-submit-btn"
            >
              {isCommenting ? 'Đang gửi...' : 'Gửi'}
            </button>
          </div>
        </div>

        {confirmDeleteId && (
          <div className="post-detail-confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
            <div className="post-detail-confirm" onClick={(e) => e.stopPropagation()}>
              <div className="post-detail-confirm-title">Xóa bình luận?</div>
              <div className="post-detail-confirm-text">Hành động này không thể hoàn tác.</div>
              <div className="post-detail-confirm-actions">
                <button
                  className="post-detail-confirm-btn ghost"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Hủy
                </button>
                <button
                  className="post-detail-confirm-btn danger"
                  onClick={() => handleDeleteComment(confirmDeleteId)}
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}

        {activeMediaIndex !== null && (
          <div className="post-lightbox" onClick={closeLightbox}>
            <button className="post-lightbox-close" onClick={closeLightbox} aria-label="Đóng ảnh">
              ×
            </button>
            <button
              className="post-lightbox-zoom post-lightbox-zoom-in"
              onClick={(event) => {
                event.stopPropagation();
                handleZoomIn();
              }}
              aria-label="Phóng to 2x"
              disabled={lightboxZoomIndex === LIGHTBOX_ZOOM_LEVELS.length - 1}
            >
              +
            </button>
            <button
              className="post-lightbox-zoom post-lightbox-zoom-out"
              onClick={(event) => {
                event.stopPropagation();
                handleZoomOut();
              }}
              aria-label="Thu nhỏ"
              disabled={lightboxZoomIndex === 0}
            >
              −
            </button>

            {mediaUrls.length > 1 && (
              <>
                <button
                  className="post-lightbox-nav post-lightbox-prev"
                  onClick={(event) => {
                    event.stopPropagation();
                    showPreviousImage();
                  }}
                  aria-label="Ảnh trước"
                >
                  <svg className="post-lightbox-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 18L9 12L15 6" />
                  </svg>
                </button>
                <button
                  className="post-lightbox-nav post-lightbox-next"
                  onClick={(event) => {
                    event.stopPropagation();
                    showNextImage();
                  }}
                  aria-label="Ảnh sau"
                >
                  <svg className="post-lightbox-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 18L15 12L9 6" />
                  </svg>
                </button>
              </>
            )}

            <div className="post-lightbox-content" onClick={(event) => event.stopPropagation()}>
              <img
                src={mediaUrls[activeMediaIndex]}
                alt={`Media ${activeMediaIndex + 1}`}
                className={`post-lightbox-image ${lightboxZoomIndex > 0 ? 'zoomed' : ''} ${isDraggingLightbox ? 'dragging' : ''}`}
                style={{
                  '--lightbox-zoom': LIGHTBOX_ZOOM_LEVELS[lightboxZoomIndex],
                  '--lightbox-pan-x': `${lightboxPan.x}px`,
                  '--lightbox-pan-y': `${lightboxPan.y}px`,
                }}
                onPointerDown={handleLightboxImageMouseDown}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostDetailModal;
