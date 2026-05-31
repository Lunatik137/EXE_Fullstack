import { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./PostCard.css";
import PropTypes from "prop-types";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";
import { getAvatarUrl } from "../../utils/avatar";
import PostDetailModal from "../PostDetailModal/PostDetailModal";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";

RestaurantNameHover.propTypes = {
  restaurantName: PropTypes.string.isRequired,
  location: PropTypes.string,
  url: PropTypes.string.isRequired,
  onClick: PropTypes.func,
};

function RestaurantNameHover({ restaurantName, location, url, onClick }) {
  const [hover, setHover] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleMouseEnter = async () => {
    setHover(true);
    if (stats || loadingStats) return;
    setLoadingStats(true);
    try {
      const res = await axios.get(`${url}/api/posts/by-restaurant/${encodeURIComponent(restaurantName)}`);
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  };

  const avgRating = stats?.avgRating ?? null;
  const reviewCount = stats?.reviewCount ?? null;

  return (
    <span className="restaurant-name-hover-wrapper">
      <span className="post-author-separator"> &gt; </span>
      <span
        className="restaurant-name-hover post-author-link"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHover(false)}
        onClick={e => { e.stopPropagation(); onClick && onClick(); }}
        tabIndex={0}
        role="button"
        aria-label={`Xem các bài review về ${restaurantName}`}
      >
        {restaurantName}
        {hover && (
          <span className="restaurant-name-tooltip">
            {location && <div><b>Địa chỉ:</b> {location}</div>}
            {loadingStats && <div style={{ color: '#9ca3af', fontSize: 12 }}>Đang tải...</div>}
            {!loadingStats && avgRating !== null && (
              <div>
                <b>Đánh giá:</b>{' '}
                <span className="restaurant-stars">
                  {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
                </span>
                {' '}({avgRating}/5 · {reviewCount} bài)
              </div>
            )}
            {!loadingStats && avgRating === null && !location && (
              <div style={{ color: '#9ca3af', fontSize: 12 }}>Chưa có đánh giá</div>
            )}
          </span>
        )}
      </span>
    </span>
  );
}

const LIGHTBOX_ZOOM_LEVELS = [1, 1.2, 1.4, 1.6, 1.8, 2];

const PostCard = ({
  post,
  onViewRecipe,
  onLikePost,
  onCommentPost,
  currentUserId,
  onPostChanged,
  showAuthorFollowButton = true,
}) => {
  const { url, token } = useContext(StoreContext);
  const navigate = useNavigate();
  const [showFullContent, setShowFullContent] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [comments, setComments] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [openPostMenu, setOpenPostMenu] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editedPostContent, setEditedPostContent] = useState(post.content);
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(null);
  const [lightboxZoomIndex, setLightboxZoomIndex] = useState(0);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isDraggingLightbox, setIsDraggingLightbox] = useState(false);
  const lightboxDragStartRef = useRef({ x: 0, y: 0 });
  const lightboxPanRafRef = useRef(null);
  const lightboxPanPendingRef = useRef({ x: 0, y: 0 });
  const lightboxPointerIdRef = useRef(null);
  const lightboxImageRef = useRef(null);
  const lightboxMaxPanRef = useRef({ x: 0, y: 0 });
  const lightboxHistoryRef = useRef(false);
  const commentModalHistoryRef = useRef(false);

  const maxLength = 150;
  const isPostOwner =
    currentUserId && post.authorId && String(post.authorId) === String(currentUserId);

  const handleAuthorClick = () => {
    if (!post.authorId) return;
    navigate(`/community?user=${post.authorId}`);
  };

  const handleFollowToggle = async () => {
    if (!token) { toast.error('Vui lòng đăng nhập'); return; }
    if (!post.authorId) return;

    if (isFollowing) {
      setShowUnfollowConfirm(true);
      return;
    }

    setFollowLoading(true);
    try {
      const endpoint = isFollowing
        ? `${url}/api/user/${post.authorId}/unfollow`
        : `${url}/api/user/${post.authorId}/follow`;
      const res = await axios.post(endpoint, {}, { headers: { token } });
      if (res.data.success) setIsFollowing(!isFollowing);
    } catch (e) {
      console.error(e);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleConfirmUnfollow = async () => {
    setShowUnfollowConfirm(false);
    if (!token || !post.authorId || !isFollowing) return;

    setFollowLoading(true);
    try {
      const endpoint = `${url}/api/user/${post.authorId}/unfollow`;
      const res = await axios.post(endpoint, {}, { headers: { token } });
      if (res.data.success) setIsFollowing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setFollowLoading(false);
    }
  };
  const shouldTruncate = editedPostContent.length > maxLength;
  const displayContent =
    shouldTruncate && !showFullContent
      ? editedPostContent.slice(0, maxLength) + "..."
      : editedPostContent;

  const renderContentWithHashtags = (content) => {
    const parts = content.split(/(#[A-Za-z0-9_]+)/g);
    return parts.map((part, index) =>
      part.startsWith("#") ? (
        <span key={`${part}-${index}`} className="hashtag">
          {part}
        </span>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      ),
    );
  };

  const getCommentId = (comment) => comment?._id || comment?.id || '';

  const formatTimeAgo = (date) => {
    if (!date) return "";
    const now = new Date();
    const commentDate = new Date(date);
    const diffInSeconds = Math.floor((now - commentDate) / 1000);

    if (diffInSeconds < 60) return "Vừa xong";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    return `${Math.floor(diffInSeconds / 604800)} tuần trước`;
  };

  // Check follow status
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!token || !post.authorId || isPostOwner) return;
      try {
        const res = await axios.get(`${url}/api/user/${post.authorId}/profile`);
        if (res.data.success && currentUserId) {
          setIsFollowing(res.data.user.followers?.map(String).includes(String(currentUserId)));
        }
      } catch (e) { /* ignore */ }
    };
    checkFollowStatus();
  }, [post.authorId, token, url, currentUserId, isPostOwner]);

  // Check if current user has liked this post
  useEffect(() => {
    const checkLikedStatus = async () => {
      if (!token || !post.id) return;

      try {
        const response = await axios.get(`${url}/api/posts/${post.id}`, {
          headers: { token },
        });
        if (response.data.success) {
          setIsLiked(response.data.isLiked || false);
        }
      } catch (error) {
        console.error("Error checking liked status:", error);
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
    setLikeCount((prev) => (wasLiked ? prev - 1 : prev + 1));

    setIsLiking(true);
    try {
      await onLikePost(post.id);
    } catch (error) {
      // Revert on error
      setIsLiked(wasLiked);
      setLikeCount((prev) => (wasLiked ? prev + 1 : prev - 1));
    }
    setIsLiking(false);
  };

  const handleCommentSubmit = async () => {
    if (isCommenting || !commentText.trim()) return;

    setIsCommenting(true);
    const success = await onCommentPost(post.id, commentText);
    if (success) {
      setCommentText("");
      toast.success("Đã đăng bình luận!");
      // Refresh comments after posting
      fetchComments();
      
      // Backend will handle sending notification to post owner
    }
    setIsCommenting(false);
  };

  const handleEditStart = (comment) => {
    setEditingCommentId(getCommentId(comment));
    setEditingCommentText(comment.content || "");
  };

  const handleEditCancel = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const handleEditSave = async (commentId) => {
    if (!token || !editingCommentText.trim()) return;
    try {
      const response = await axios.put(
        `${url}/api/posts/${post.id}/comment/${commentId}`,
        { content: editingCommentText },
        { headers: { token } },
      );
      if (response.data.success) {
        handleEditCancel();
        fetchComments();
        toast.success("Đã cập nhật bình luận");
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Không thể chỉnh sửa bình luận. Vui lòng thử lại.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!token) return;
    try {
      const response = await axios.delete(
        `${url}/api/posts/${post.id}/comment/${commentId}`,
        { headers: { token } },
      );
      if (response.data.success) {
        fetchComments();
        toast.success("Đã xóa bình luận");
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Không thể xóa bình luận. Vui lòng thử lại.");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${url}/api/posts/${post.id}`);
      if (response.data.success && response.data.post.comments) {
        setComments(response.data.post.comments);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const displayedComments = showAllComments ? comments : comments.slice(0, 2);
  const hasMoreComments = comments.length > 2;
  const visibleMedia = (post.media || []).filter((item) => item?.url).slice(0, 5);
  const mediaCount = visibleMedia.length;
  const mediaUrls = visibleMedia.map((item) => `${url}/images/posts/${item.url}`);

  const openLightbox = (index) => {
    setActiveMediaIndex(index);
    setLightboxZoomIndex(0);
    setLightboxPan({ x: 0, y: 0 });
    setIsDraggingLightbox(false);
    window.history.pushState({ modal: 'lightbox', postId: post.id }, '');
    lightboxHistoryRef.current = true;
  };

  const closeLightbox = () => {
    setActiveMediaIndex(null);
    setLightboxZoomIndex(0);
    setLightboxPan({ x: 0, y: 0 });
    setIsDraggingLightbox(false);
    if (lightboxHistoryRef.current) {
      lightboxHistoryRef.current = false;
      window.history.back();
    }
  };

  const openCommentModal = () => {
    setShowCommentModal(true);
    window.history.pushState({ modal: 'comment', postId: post.id }, '');
    commentModalHistoryRef.current = true;
  };

  const closeCommentModal = () => {
    setShowCommentModal(false);
    if (commentModalHistoryRef.current) {
      commentModalHistoryRef.current = false;
      window.history.back();
    }
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

    // Tính giới hạn kéo thả dựa trên kích thước ảnh và mức zoom hiện tại
    if (lightboxImageRef.current) {
      const zoom = LIGHTBOX_ZOOM_LEVELS[lightboxZoomIndex];
      const zoomedW = lightboxImageRef.current.offsetWidth * zoom;
      const zoomedH = lightboxImageRef.current.offsetHeight * zoom;
      lightboxMaxPanRef.current = {
        x: Math.max(0, (zoomedW - window.innerWidth) / 2),
        y: Math.max(0, (zoomedH - window.innerHeight) / 2),
      };
    }

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

      const rawX = event.clientX - lightboxDragStartRef.current.x;
      const rawY = event.clientY - lightboxDragStartRef.current.y;
      const { x: maxX, y: maxY } = lightboxMaxPanRef.current;
      lightboxPanPendingRef.current = {
        x: Math.max(-maxX, Math.min(maxX, rawX)),
        y: Math.max(-maxY, Math.min(maxY, rawY)),
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

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      if (lightboxPanRafRef.current !== null) {
        window.cancelAnimationFrame(lightboxPanRafRef.current);
        lightboxPanRafRef.current = null;
      }
    };
  }, [isDraggingLightbox]);

  useEffect(() => {
    setEditedPostContent(post.content);
  }, [post.content]);

  // Kẹp pan khi zoom thay đổi (vd: zoom out → ảnh không còn tràn → reset về 0)
  useEffect(() => {
    if (!lightboxImageRef.current || lightboxZoomIndex === 0) {
      setLightboxPan({ x: 0, y: 0 });
      return;
    }
    const zoom = LIGHTBOX_ZOOM_LEVELS[lightboxZoomIndex];
    const maxX = Math.max(0, (lightboxImageRef.current.offsetWidth * zoom - window.innerWidth) / 2);
    const maxY = Math.max(0, (lightboxImageRef.current.offsetHeight * zoom - window.innerHeight) / 2);
    setLightboxPan((prev) => ({
      x: Math.max(-maxX, Math.min(maxX, prev.x)),
      y: Math.max(-maxY, Math.min(maxY, prev.y)),
    }));
  }, [lightboxZoomIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLightboxOpen = activeMediaIndex !== null;

  // Xử lý nút Back khi lightbox đang mở
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handlePopState = () => {
      lightboxHistoryRef.current = false;
      setActiveMediaIndex(null);
      setLightboxZoomIndex(0);
      setLightboxPan({ x: 0, y: 0 });
      setIsDraggingLightbox(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLightboxOpen]);

  // Xử lý nút Back khi comment modal đang mở
  useEffect(() => {
    if (!showCommentModal) return;
    const handlePopState = () => {
      commentModalHistoryRef.current = false;
      setShowCommentModal(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showCommentModal]);

  // Khoá cuộn trang khi lightbox mở
  useEffect(() => {
    if (!isLightboxOpen) return;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isLightboxOpen]);

  useEffect(() => {
    if (activeMediaIndex === null) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPreviousImage();
      if (event.key === "ArrowRight") showNextImage();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMediaIndex, mediaUrls.length, showPreviousImage, showNextImage]);

  useEffect(() => {
    const handleOutsideMenuClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (!target.closest(".post-menu-wrapper")) {
        setOpenPostMenu(false);
      }

      if (!target.closest(".comment-menu-wrapper")) {
        setOpenCommentMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideMenuClick);
    return () => document.removeEventListener("mousedown", handleOutsideMenuClick);
  }, []);

  const handleEditPostSave = async () => {
    const normalizedContent = editedPostContent.trim();
    if (!token || !normalizedContent) {
      toast.error("Nội dung bài viết không được để trống");
      return;
    }

    try {
      const response = await axios.put(
        `${url}/api/posts/${post.id}`,
        { content: normalizedContent },
        { headers: { token } },
      );

      if (response.data.success) {
        setEditedPostContent(normalizedContent);
        setIsEditingPost(false);
        setOpenPostMenu(false);
        toast.success("Đã cập nhật bài viết");
        if (onPostChanged) onPostChanged();
      }
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Không thể cập nhật bài viết. Vui lòng thử lại.");
    }
  };

  const handleDeletePost = async () => {
    if (!token) return;

    try {
      const response = await axios.delete(`${url}/api/posts/${post.id}`, {
        headers: { token },
      });

      if (response.data.success) {
        toast.success("Đã xóa bài viết");
        setConfirmDeletePost(false);
        if (onPostChanged) onPostChanged();
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Không thể xóa bài viết. Vui lòng thử lại.");
    }
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <img
          src={post.avatar}
          alt={post.author}
          className={`post-avatar${!isPostOwner && post.authorId ? ' post-avatar-clickable' : ''}`}
          onClick={!isPostOwner && post.authorId ? handleAuthorClick : undefined}
        />
        <div className="post-author-info">
          <h4 className="post-author">
            {/* Tên user */}
            <span
              className={!isPostOwner && post.authorId ? 'post-author-link' : ''}
              onClick={!isPostOwner && post.authorId ? handleAuthorClick : undefined}
            >
              {post.type === 'review' && post.reviewData?.restaurantName
                ? (post.author.includes(' > ') ? post.author.split(' > ')[0] : post.author)
                : post.author}
            </span>
            {/* Nếu là bài review, hiển thị tên quán riêng biệt */}
            {post.type === 'review' && post.reviewData?.restaurantName && (
              <RestaurantNameHover
                restaurantName={post.reviewData.restaurantName}
                location={post.reviewData.location}
                url={url}
                onClick={() => navigate(`/community?restaurant=${encodeURIComponent(post.reviewData.restaurantName)}`)}
              />
            )}
            {post.verified && <span className="verified-badge">✓</span>}
          </h4>
          <span className="post-time">{post.time}</span>
        </div>
        {!isPostOwner && post.authorId && token && showAuthorFollowButton && (
          <button
            className={`follow-btn${isFollowing ? ' follow-btn-following' : ''}`}
            onClick={handleFollowToggle}
            disabled={followLoading}
          >
            {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
          </button>
        )}

        {isPostOwner && (
          <div className="post-menu-wrapper">
            <button
              className="post-menu-btn"
              onClick={() => setOpenPostMenu((prev) => !prev)}
              aria-label="Tùy chọn bài viết"
            >
              <svg
                width="25"
                height="25"
                viewBox="0 0 256 256"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
              >
                <circle cx="80" cy="128" r="12" />
                <circle cx="128" cy="128" r="12" />
                <circle cx="176" cy="128" r="12" />
              </svg>
            </button>
            {openPostMenu && (
              <div className="post-menu-dropdown">
                <button
                  className="post-menu-item"
                  onClick={() => {
                    setIsEditingPost(true);
                    setOpenPostMenu(false);
                  }}
                >
                  Chỉnh sửa
                </button>
                <button
                  className="post-menu-item danger"
                  onClick={() => {
                    setOpenPostMenu(false);
                    setConfirmDeletePost(true);
                  }}
                >
                  Xóa
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isEditingPost ? (
        <div className="post-edit-box">
          <textarea
            className="post-edit-input"
            value={editedPostContent}
            onChange={(event) => setEditedPostContent(event.target.value)}
          />
          <div className="post-edit-actions">
            <button className="comment-action-btn" onClick={handleEditPostSave}>
              Lưu
            </button>
            <button
              className="comment-action-btn"
              onClick={() => {
                setIsEditingPost(false);
                setEditedPostContent(post.content);
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.type === 'review' && post.reviewData?.rating > 0 && (
            <div className="post-review-stars">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={s <= post.reviewData.rating ? 'post-star filled' : 'post-star'}>
                  ★
                </span>
              ))}
            </div>
          )}
          <p className="post-content">
            {renderContentWithHashtags(displayContent)}
          {shouldTruncate && (
            <button
              className="read-more-btn"
              onClick={() => setShowFullContent(!showFullContent)}
            >
              {showFullContent ? " Thu gọn" : " Xem thêm"}
            </button>
          )}
          </p>
        </>
      )}

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

      <div className="post-footer">
        <div className="post-stats">
          <button
            className={`stat-btn like-btn ${isLiked ? "liked" : ""} ${isLiking ? "disabled" : ""}`}
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
            onClick={openCommentModal}
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
            <span>{comments.length}</span>
          </button>
        </div>
        {post.hasRecipe && (
          <button
            className="view-recipe-btn"
            onClick={() => onViewRecipe(post)}
          >
            Xem công thức
          </button>
        )}
      </div>

      {showCommentInput && (
        <div className="comment-input-section">
          <input
            type="text"
            placeholder="Viết bình luận..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleCommentSubmit()}
            className="comment-input"
          />
          <button
            onClick={handleCommentSubmit}
            disabled={isCommenting || !commentText.trim()}
            className="comment-submit-btn"
          >
            {isCommenting ? "Đang gửi..." : "Gửi"}
          </button>
        </div>
      )}

      {confirmDeleteId && (
        <div className="comment-confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="comment-confirm" onClick={(event) => event.stopPropagation()}>
            <div className="comment-confirm-title">Xóa bình luận?</div>
            <div className="comment-confirm-text">Hành động này không thể hoàn tác.</div>
            <div className="comment-confirm-actions">
              <button
                className="comment-confirm-btn ghost"
                onClick={() => setConfirmDeleteId(null)}
              >
                Hủy
              </button>
              <button
                className="comment-confirm-btn danger"
                onClick={() => handleDeleteComment(confirmDeleteId)}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeletePost && (
        <div className="comment-confirm-overlay" onClick={() => setConfirmDeletePost(false)}>
          <div className="comment-confirm" onClick={(event) => event.stopPropagation()}>
            <div className="comment-confirm-title">Xóa bài viết?</div>
            <div className="comment-confirm-text">Hành động này không thể hoàn tác.</div>
            <div className="comment-confirm-actions">
              <button
                className="comment-confirm-btn ghost"
                onClick={() => setConfirmDeletePost(false)}
              >
                Hủy
              </button>
              <button className="comment-confirm-btn danger" onClick={handleDeletePost}>
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
                <svg
                  className="post-lightbox-nav-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
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
                <svg
                  className="post-lightbox-nav-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M9 18L15 12L9 6" />
                </svg>
              </button>
            </>
          )}

          <div className="post-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <img
              src={mediaUrls[activeMediaIndex]}
              alt={`Media ${activeMediaIndex + 1}`}
              ref={lightboxImageRef}
              className={`post-lightbox-image ${lightboxZoomIndex > 0 ? "zoomed" : ""} ${isDraggingLightbox ? "dragging" : ""}`}
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

      <PostDetailModal
        post={post}
        isOpen={showCommentModal}
        onClose={closeCommentModal}
        currentUserId={currentUserId}
        onCommentsChanged={setComments}
        onLikeStateChanged={({ isLiked: nextIsLiked, likeCount: nextLikeCount }) => {
          setIsLiked(nextIsLiked);
          setLikeCount(nextLikeCount);
        }}
      />

      <ConfirmDialog
        isOpen={showUnfollowConfirm}
        title="Bạn có chắc không?"
        message="Bạn có chắc chắn muốn hủy theo dõi người dùng này không?"
        cancelText="Hủy"
        confirmText="Hủy theo dõi"
        onClose={() => setShowUnfollowConfirm(false)}
        onConfirm={handleConfirmUnfollow}
      />
    </div>
  );
};

PostCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    authorId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    author: PropTypes.string.isRequired,
    avatar: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    media: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.string,
      url: PropTypes.string
    })),
    hasRecipe: PropTypes.bool,
    verified: PropTypes.bool,
    likes: PropTypes.number,
    likesArray: PropTypes.array,
    comments: PropTypes.number,
    commentsData: PropTypes.array,
    recipe: PropTypes.object,
    type: PropTypes.string,
    hashtags: PropTypes.array,
    reviewData: PropTypes.shape({
      restaurantName: PropTypes.string,
      location: PropTypes.string,
      rating: PropTypes.number,
    }),
  }).isRequired,
  onViewRecipe: PropTypes.func,
  onLikePost: PropTypes.func.isRequired,
  onCommentPost: PropTypes.func.isRequired,
  currentUserId: PropTypes.string,
  onPostChanged: PropTypes.func,
  showAuthorFollowButton: PropTypes.bool,
};

export default PostCard;
