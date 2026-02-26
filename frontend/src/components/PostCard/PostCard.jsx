import { useState, useEffect, useContext } from "react";
import "./PostCard.css";
import PropTypes from "prop-types";
import { StoreContext } from "../../context/StoreContext";
import notificationService from "../../services/notificationService";
import axios from "axios";
import { toast } from "react-toastify";

const PostCard = ({
  post,
  onViewRecipe,
  onLikePost,
  onCommentPost,
  currentUserId,
}) => {
  const { url, token } = useContext(StoreContext);
  const [showFullContent, setShowFullContent] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [comments, setComments] = useState([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const maxLength = 150;
  const shouldTruncate = post.content.length > maxLength;
  const displayContent =
    shouldTruncate && !showFullContent
      ? post.content.slice(0, maxLength) + "..."
      : post.content;

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
      
      // Send notification if user just liked (not unliked)
      if (!wasLiked) {
        // Request permission just before sending notification
        const hasPermission = await notificationService.requestPermission();
        if (hasPermission) {
          await notificationService.subscribe();
          notificationService.notifyNewLike('User', post.content.substring(0, 50));
        }
      }
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
      // Refresh comments after posting
      fetchComments();
      
      // Send notification for new comment
      const hasPermission = await notificationService.requestPermission();
      if (hasPermission) {
        await notificationService.subscribe();
        notificationService.notifyNewComment('User', post.content.substring(0, 50));
      }
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

      {post.image && (
        <div className="post-image-container">
          <img src={post.image} alt="Post" className="post-image" />
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
            <span>{comments.length}</span>
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
            Xem công thức
          </button>
        )}
      </div>

      {/* Comments Section */}
      <div className="comments-section">
        {comments.length > 0 ? (
          <>
            {displayedComments.map((comment, index) => {
              const commentId = getCommentId(comment);
              return (
              <div key={commentId || index} className="comment-item">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userId?.name || "User")}&background=10b981&color=fff`}
                  alt={comment.userId?.name || "User"}
                  className="comment-avatar"
                />
                <div className="comment-content">
                  <div className="comment-header">
                    <div className="comment-author">
                      {comment.userId?.name || "Người dùng"}
                    </div>
                    <div className="comment-meta">
                      <span className="comment-time">
                        {formatTimeAgo(comment.createdAt)}
                      </span>
                      {currentUserId &&
                        String(comment.userId?._id || comment.userId) ===
                          String(currentUserId) && (
                          <div className="comment-menu-wrapper">
                            <button
                              className="comment-menu-btn"
                              onClick={() =>
                                setOpenCommentMenuId(
                                  openCommentMenuId === commentId
                                    ? null
                                    : commentId,
                                )
                              }
                              aria-label="Tùy chọn bình luận"
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
                            {openCommentMenuId === commentId && (
                              <div className="comment-menu">
                                <button
                                  className="comment-menu-item"
                                  onClick={() => {
                                    setOpenCommentMenuId(null);
                                    handleEditStart(comment);
                                  }}
                                >
                                  Chỉnh sửa
                                </button>
                                <button
                                  className="comment-menu-item danger"
                                  onClick={() => {
                                    setOpenCommentMenuId(null);
                                    setConfirmDeleteId(commentId);
                                  }}
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                  {editingCommentId === commentId ? (
                    <div className="comment-edit">
                      <input
                        type="text"
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        className="comment-edit-input"
                      />
                      <div className="comment-edit-actions">
                        <button
                          className="comment-action-btn"
                          onClick={() => handleEditSave(commentId)}
                        >
                          Lưu
                        </button>
                        <button
                          className="comment-action-btn"
                          onClick={handleEditCancel}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="comment-text">{comment.content}</div>
                  )}
                </div>
              </div>
            );
            })}
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
          </>
        ) : (
          <div className="no-comments">Chưa có bình luận</div>
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
  currentUserId: PropTypes.string,
};

export default PostCard;
