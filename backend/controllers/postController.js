import postModel from "../models/postModel.js";
import userModel from "../models/userModel.js";
import { notifyNewComment, notifyNewLike } from "./notificationController.js";

// Create a new post
const createPost = async (req, res) => {
  try {
    const { type, content, hashtags, recipeData, reviewData } = req.body;
    const userId = req.body.userId;

    // Validate required fields based on post type
    if (type === 'recipe' && !recipeData) {
      return res.json({ success: false, message: "Recipe data is required for recipe posts" });
    }

    if (type === 'review' && !reviewData) {
      return res.json({ success: false, message: "Review data is required for review posts" });
    }

    const newPost = new postModel({
      userId,
      type: type || 'normal',
      content,
      hashtags: hashtags || [],
      recipeData: type === 'recipe' ? recipeData : undefined,
      reviewData: type === 'review' ? reviewData : undefined
    });

    await newPost.save();
    
    // Populate user data
    await newPost.populate('userId', 'name email');

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
      .populate('userId', 'name email')
      .populate('comments.userId', 'name');

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
      .populate('userId', 'name email')
      .populate('comments.userId', 'name');

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
      .populate('userId', 'name email')
      .populate('comments.userId', 'name');

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
      .populate('userId', 'name email')
      .populate('comments.userId', 'name');

    res.json({ success: true, posts });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error fetching user posts" });
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
      console.log('🔔 Sending like notification');
      console.log('   Post creator:', post.userId.toString());
      console.log('   Liker:', userId);
      const likeUser = await userModel.findById(userId);
      const likeUserName = likeUser?.name || "Someone";
      console.log('   Liker name:', likeUserName);
      await notifyNewLike(
        post.userId.toString(),
        likeUserName,
        post.content.substring(0, 50)
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
    await post.populate('comments.userId', 'name');

    // Send notification to post creator if commenter is not the post creator
    if (userId !== post.userId.toString()) {
      console.log('🔔 Sending comment notification');
      console.log('   Post creator:', post.userId.toString());
      console.log('   Commenter:', userId);
      const commentUser = await userModel.findById(userId);
      const commentUserName = commentUser?.name || "Someone";
      console.log('   Commenter name:', commentUserName);
      await notifyNewComment(
        post.userId.toString(),
        commentUserName,
        post.content.substring(0, 50)
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

    const post = await postModel.findById(id).populate('comments.userId', 'name');

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
    await post.populate('comments.userId', 'name');

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

    const post = await postModel.findById(id).populate('comments.userId', 'name');

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
    await post.populate('comments.userId', 'name');

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
      .populate('userId', 'name email')
      .populate('comments.userId', 'name');

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

export {
  createPost,
  getAllPosts,
  getPostsByType,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost,
  likePost,
  addComment,
  updateComment,
  deleteComment,
  getPostsByHashtag,
  getTrendingHashtags
};
