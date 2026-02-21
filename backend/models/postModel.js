import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  type: {
    type: String,
    enum: ['normal', 'recipe', 'nutrition-qa', 'review'],
    default: 'normal'
  },
  content: {
    type: String,
    required: true
  },
  hashtags: [{
    type: String,
    trim: true
  }],
  media: [{
    type: {
      type: String,
      enum: ['image', 'video']
    },
    url: String
  }],
  
  // Recipe-specific fields (only for type='recipe')
  recipeData: {
    title: String,
    ingredients: [{
      name: String,
      amount: String
    }],
    instructions: [String],
    cookingTime: Number,
    servings: Number,
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard']
    },
    category: String,
    nutrition: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      fiber: Number
    }
  },
  
  // Review-specific fields (only for type='review')
  reviewData: {
    restaurantName: String,
    location: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }],
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPublished: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ type: 1 });
postSchema.index({ hashtags: 1 });

const postModel = mongoose.models.post || mongoose.model("post", postSchema);

export default postModel;
