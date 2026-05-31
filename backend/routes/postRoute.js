import express from "express";
import multer from "multer";
import {
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
} from "../controllers/postController.js";
import authMiddleware from "../middleware/auth.js";
import optionalAuthMiddleware from "../middleware/optionalAuth.js";

const postRouter = express.Router();

// Multer config for post images
const storage = multer.diskStorage({
  destination: "uploads/posts",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });

// Public routes
postRouter.get("/", getAllPosts);
postRouter.get("/trending-hashtags", getTrendingHashtags);
postRouter.get("/search", searchPosts);
postRouter.get("/restaurants/suggest", getRestaurantSuggestions);
postRouter.get("/type/:type", getPostsByType);
postRouter.get("/hashtag/:hashtag", getPostsByHashtag);
postRouter.get("/by-user/:userId", getPostsByUser);
postRouter.get("/by-restaurant/:name", getPostsByRestaurant);
postRouter.get("/:id", optionalAuthMiddleware, getPostById);

// Protected routes (require authentication)
postRouter.post("/create", authMiddleware, upload.array("images", 5), createPost);
postRouter.post("/my-posts", authMiddleware, getUserPosts);
postRouter.post("/following-posts", authMiddleware, getFollowingPosts);
postRouter.post("/liked-posts", authMiddleware, getLikedPosts);
postRouter.put("/:id", authMiddleware, updatePost);
postRouter.delete("/:id", authMiddleware, deletePost);
postRouter.post("/:id/like", authMiddleware, likePost);
postRouter.post("/:id/comment", authMiddleware, addComment);
postRouter.put("/:id/comment/:commentId", authMiddleware, updateComment);
postRouter.delete("/:id/comment/:commentId", authMiddleware, deleteComment);

export default postRouter;
