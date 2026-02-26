import express from "express";
import {
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
} from "../controllers/postController.js";
import authMiddleware from "../middleware/auth.js";
import optionalAuthMiddleware from "../middleware/optionalAuth.js";

const postRouter = express.Router();

// Public routes
postRouter.get("/", getAllPosts);
postRouter.get("/trending-hashtags", getTrendingHashtags);
postRouter.get("/type/:type", getPostsByType);
postRouter.get("/hashtag/:hashtag", getPostsByHashtag);
postRouter.get("/:id", optionalAuthMiddleware, getPostById);

// Protected routes (require authentication)
postRouter.post("/create", authMiddleware, createPost);
postRouter.post("/my-posts", authMiddleware, getUserPosts);
postRouter.put("/:id", authMiddleware, updatePost);
postRouter.delete("/:id", authMiddleware, deletePost);
postRouter.post("/:id/like", authMiddleware, likePost);
postRouter.post("/:id/comment", authMiddleware, addComment);
postRouter.put("/:id/comment/:commentId", authMiddleware, updateComment);
postRouter.delete("/:id/comment/:commentId", authMiddleware, deleteComment);

export default postRouter;
