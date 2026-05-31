import postModel from "../models/postModel.js";
import userModel from "../models/userModel.js";
import { notifyNewComment, notifyNewLike } from "./notificationController.js";

// Create a new post
const createPost = async (req, res) => {
  try {
    // Get userId from req.userId (set by authMiddleware before multer)
    const userId = req.userId || req.body.userId;
    let { type, content, hashtags, recipeData, reviewData } = req.body;

    if (!userId) {
      return res.json({ success: false, message: "User not authenticated" });
    }

    // Parse JSON strings from FormData
    if (typeof hashtags === 'string') {
      hashtags = JSON.parse(hashtags);
    }
    if (typeof recipeData === 'string') {
      recipeData = JSON.parse(recipeData);
    }
    if (typeof reviewData === 'string') {
      reviewData = JSON.parse(reviewData);
    }

    // Validate required fields based on post type
    if (type === 'recipe' && !recipeData) {
      return res.json({ success: false, message: "Recipe data is required for recipe posts" });
    }

    if (type === 'review' && !reviewData) {
      return res.json({ success: false, message: "Review data is required for review posts" });
    }

    // Process uploaded images
    const media = req.files ? req.files.map(file => ({
      type: 'image',
      url: file.filename
    })) : [];

    const newPost = new postModel({
      userId,
      type: type || 'normal',
      content,
      hashtags: hashtags || [],
      media,
      recipeData: type === 'recipe' ? recipeData : undefined,
      reviewData: type === 'review' ? reviewData : undefined
    });

    await newPost.save();
    
    // Populate user data
    await newPost.populate('userId', 'name email avatar verified');

    res.json({ success: true, message: "Post created successfully", post: newPost });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error creating post" });
  }
};

// Get all posts (with pagination)
const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await postModel
      .find({ isPublished: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email avatar verified')
      .populate('comments.userId', 'name avatar');

    const total = await postModel.countDocuments({ isPublished: true });

    res.json({
      success: true,
      posts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalPosts: total,
        hasMore: skip + posts.length < total
      }
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching posts" });
  }
};

// Get posts by type
const getPostsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await postModel
      .find({ type, isPublished: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email avatar verified')
      .populate('comments.userId', 'name avatar');

    const total = await postModel.countDocuments({ type, isPublished: true });

    res.json({
      success: true,
      posts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalPosts: total
      }
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching posts" });
  }
};

// Get single post by ID
// Get a single post by ID
const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId; // From auth middleware (optional)
    
    const post = await postModel
      .findById(id)
      .populate('userId', 'name email avatar verified')
      .populate('comments.userId', 'name avatar');

    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    // Check if current user has liked this post
    let isLiked = false;
    if (userId && post.likes) {
      isLiked = post.likes.some(likeUserId => likeUserId.toString() === userId.toString());
    }

    res.json({ success: true, post, isLiked });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching post" });
  }
};

// Get posts by user
const getUserPosts = async (req, res) => {
  try {
    const userId = req.body.userId;

    const posts = await postModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email avatar verified')
      .populate('comments.userId', 'name avatar');

    res.json({ success: true, posts });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching user posts" });
  }
};

const getFollowingPosts = async (req, res) => {
  try {
    const userId = req.body.userId;
    const currentUser = await userModel.findById(userId).select('following');

    if (!currentUser) {
      return res.json({ success: false, message: "User not found" });
    }

    const followingIds = currentUser.following || [];
    if (followingIds.length === 0) {
      return res.json({ success: true, posts: [] });
    }

    const posts = await postModel
      .find({ userId: { $in: followingIds }, isPublished: true })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email avatar verified')
      .populate('comments.userId', 'name avatar');

    res.json({ success: true, posts });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching following posts" });
  }
};

const getLikedPosts = async (req, res) => {
  try {
    const userId = req.body.userId;

    const posts = await postModel
      .find({ likes: userId, isPublished: true })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email avatar verified')
      .populate('comments.userId', 'name avatar');

    res.json({ success: true, posts });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching liked posts" });
  }
};

// Update post
const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;
    const updateData = req.body;

    const post = await postModel.findById(id);

    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    // Check if user is the post owner
    if (post.userId.toString() !== userId) {
      return res.json({ success: false, message: "Unauthorized to update this post" });
    }

    // Update allowed fields
    const allowedUpdates = ['content', 'hashtags', 'recipeData', 'reviewData', 'isPublished'];
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        post[field] = updateData[field];
      }
    });

    await post.save();

    res.json({ success: true, message: "Post updated successfully", post });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error updating post" });
  }
};

// Delete post
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;

    const post = await postModel.findById(id);

    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    // Check if user is the post owner
    if (post.userId.toString() !== userId) {
      return res.json({ success: false, message: "Unauthorized to delete this post" });
    }

    await postModel.findByIdAndDelete(id);

    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error deleting post" });
  }
};

// Like/Unlike post
const likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;

    const post = await postModel.findById(id);

    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    const likeIndex = post.likes.indexOf(userId);
    let wasLiked = false;

    if (likeIndex === -1) {
      // Like the post
      post.likes.push(userId);
      wasLiked = true;
    } else {
      // Unlike the post
      post.likes.splice(likeIndex, 1);
      wasLiked = false;
    }

    await post.save();

    // Send notification to post creator if liked
    if (wasLiked && userId !== post.userId.toString()) {
      console.log("🔔 Sending like notification from user", userId, "to post owner", post.userId);
      const likeUser = await userModel.findById(userId);
      const likeUserName = likeUser?.name || "Someone";
      const likeUserAvatar = likeUser?.avatar || "";
      console.log("👤 Like user name:", likeUserName);
      await notifyNewLike(
        post.userId,
        likeUserName,
        post._id,
        post.content,
        likeUserAvatar
      );
    }

    res.json({ 
      success: true, 
      message: wasLiked ? "Post liked" : "Post unliked",
      likesCount: post.likes.length
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error liking post" });
  }
};

// Add comment to post
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.json({ success: false, message: "Comment content is required" });
    }

    const post = await postModel.findById(id);

    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    post.comments.push({
      userId,
      content,
      createdAt: new Date()
    });

    await post.save();
    await post.populate('comments.userId', 'name avatar');

    // Send notification to post creator if commenter is not the post creator
    if (userId !== post.userId.toString()) {
      const commentUser = await userModel.findById(userId);
      const commentUserName = commentUser?.name || "Someone";
      const commentUserAvatar = commentUser?.avatar || "";
      await notifyNewComment(
        post.userId,
        commentUserName,
        post._id,
        post.content,
        commentUserAvatar
      );
    }

    res.json({ 
      success: true, 
      message: "Comment added successfully",
      comments: post.comments
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error adding comment" });
  }
};

// Update comment
const updateComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.body.userId;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.json({ success: false, message: "Comment content is required" });
    }

    const post = await postModel.findById(id).populate('comments.userId', 'name avatar');

    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.json({ success: false, message: "Comment not found" });
    }

    const commentUserId = comment.userId?._id || comment.userId;
    if (commentUserId.toString() !== userId.toString()) {
      return res.json({ success: false, message: "Unauthorized to update this comment" });
    }

    comment.content = content;
    comment.updatedAt = new Date();
    await post.save();
    await post.populate('comments.userId', 'name avatar');

    res.json({
      success: true,
      message: "Comment updated successfully",
      comments: post.comments
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error updating comment" });
  }
};

// Delete comment
const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.body.userId;

    const post = await postModel.findById(id).populate('comments.userId', 'name avatar');

    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.json({ success: false, message: "Comment not found" });
    }

    const commentUserId = comment.userId?._id || comment.userId;
    if (commentUserId.toString() !== userId.toString()) {
      return res.json({ success: false, message: "Unauthorized to delete this comment" });
    }

    comment.deleteOne();
    await post.save();
    await post.populate('comments.userId', 'name avatar');

    res.json({
      success: true,
      message: "Comment deleted successfully",
      comments: post.comments
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error deleting comment" });
  }
};

// Get posts by hashtag
const getPostsByHashtag = async (req, res) => {
  try {
    const { hashtag } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Case-insensitive hashtag search
    const posts = await postModel
      .find({ 
        hashtags: { $regex: new RegExp(`^${hashtag}$`, 'i') },
        isPublished: true 
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email avatar verified')
      .populate('comments.userId', 'name avatar');

    const total = await postModel.countDocuments({ 
      hashtags: { $regex: new RegExp(`^${hashtag}$`, 'i') },
      isPublished: true 
    });

    res.json({
      success: true,
      posts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalPosts: total
      }
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching posts by hashtag" });
  }
};

// Search posts by content, hashtags, recipe title, restaurant name, or author name
const searchPosts = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json({ success: true, posts: [] });

    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    // Find users whose name matches the query so we can include their posts
    const matchedUsers = await userModel.find({ name: regex }).select('_id').limit(20);
    const matchedUserIds = matchedUsers.map((u) => u._id);

    const orConditions = [
      { content: regex },
      { hashtags: regex },
      { 'recipeData.title': regex },
      { 'reviewData.restaurantName': regex },
      { 'reviewData.location': regex },
    ];
    if (matchedUserIds.length > 0) {
      orConditions.push({ userId: { $in: matchedUserIds } });
    }

    const posts = await postModel
      .find({
        isPublished: true,
        $or: orConditions,
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name avatar');

    res.json({ success: true, posts });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error searching posts' });
  }
};

// Get published posts by a specific user (public)
const getPostsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const posts = await postModel
      .find({ userId, isPublished: true })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email avatar verified')
      .populate('comments.userId', 'name avatar');
    res.json({ success: true, posts });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error fetching user posts' });
  }
};

// Get trending hashtags
const getTrendingHashtags = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Aggregate hashtags from all posts
    const trendingHashtags = await postModel.aggregate([
      { $match: { isPublished: true } },
      { $unwind: "$hashtags" },
      {
        $group: {
          _id: { $toLower: "$hashtags" },
          count: { $sum: 1 },
          originalTag: { $first: "$hashtags" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          hashtag: "$originalTag",
          count: 1
        }
      }
    ]);

    res.json({ success: true, hashtags: trendingHashtags });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching trending hashtags" });
  }
};

// Search restaurant name suggestions (autocomplete)
const getRestaurantSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json({ success: true, restaurants: [] });

    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const results = await postModel.aggregate([
      {
        $match: {
          isPublished: true,
          type: 'review',
          'reviewData.restaurantName': regex
        }
      },
      {
        $group: {
          _id: { $toLower: '$reviewData.restaurantName' },
          restaurantName: { $first: '$reviewData.restaurantName' },
          location: { $first: '$reviewData.location' }
        }
      },
      { $sort: { restaurantName: 1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          restaurantName: 1,
          location: 1
        }
      }
    ]);

    res.json({ success: true, restaurants: results });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error fetching restaurant suggestions' });
  }
};

// Get all review posts for a specific restaurant + aggregate stats
const getPostsByRestaurant = async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name || '');
    if (!name.trim()) return res.json({ success: false, message: 'Restaurant name is required' });

    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const posts = await postModel
      .find({
        isPublished: true,
        type: 'review',
        'reviewData.restaurantName': regex
      })
      .sort({ createdAt: -1 })
      .populate('userId', 'name avatar verified')
      .populate('comments.userId', 'name avatar');

    const reviewsWithRating = posts.filter(p => p.reviewData?.rating);
    const avgRating = reviewsWithRating.length > 0
      ? reviewsWithRating.reduce((sum, p) => sum + p.reviewData.rating, 0) / reviewsWithRating.length
      : null;

    // Get location from first post that has it
    const location = posts.find(p => p.reviewData?.location)?.reviewData?.location || null;

    res.json({
      success: true,
      posts,
      stats: {
        reviewCount: posts.length,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        location
      }
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error fetching restaurant posts' });
  }
};

export {
  createPost,
  getAllPosts,
  getPostsByType,
  getPostById,
  getUserPosts,
  getFollowingPosts,
  getLikedPosts,
  getPostsByUser,
  searchPosts,
  updatePost,
  deletePost,
  likePost,
  addComment,
  updateComment,
  deleteComment,
  getPostsByHashtag,
  getTrendingHashtags,
  getPostsByRestaurant,
  getRestaurantSuggestions
};
