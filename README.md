# 🌱 GreenPath - Intelligent Health & Nutrition Platform

GreenPath is a comprehensive health and nutrition platform built with the MERN stack. It combines food delivery, personalized meal planning with AI, recipe discovery, weight tracking, and a vibrant community to help users achieve their health goals through sustainable, plant-based nutrition.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-18.3.1-blue)](https://reactjs.org/)

## 📚 Documentation

For detailed development guides and architecture:

- 📖 **[Documentation Guide](DOCUMENTATION_GUIDE.md)** - How to use all documentation files
- 🏗️ **[Architecture Mapping](ARCHITECTURE_MAPPING.md)** - Complete architecture, API references, and data models (500+ lines)
- ⚡ **[CLI Context Guide](CLI_CONTEXT_GUIDE.md)** - Quick reference for daily development
- 🤖 **[AI CLI Context Prompts](AI_CLI_CONTEXT_PROMPTS.md)** - Detailed templates for working with AI assistants
- 🚀 **[AI Quick Start](AI_QUICK_START.md)** - Super quick copy-paste templates for AI (fastest reference!)

**Quick Start for Developers**: Read [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) to know which file to use when!

**For AI CLI Users**: Start with [AI_QUICK_START.md](AI_QUICK_START.md) for instant copy-paste templates!

## ✨ Features

### 🍽️ Food Ordering System
- Browse and order healthy, plant-based meals
- Smart filtering by dietary preferences and nutrition goals
- Real-time cart management
- Seamless checkout process
- Order tracking and history

### 🤖 AI-Powered Meal Planning
- Personalized meal plans generated with Google Gemini AI
- Custom nutrition targets based on user goals
- 7-day meal plans with balanced macros
- Flexible meal customization
- Nutrition statistics and insights

### 📚 Recipe Library
- Extensive collection of vegan recipes
- Categorized by meal type, difficulty, and cuisine
- Detailed nutritional information
- Step-by-step cooking instructions
- Save favorite recipes

### 📊 Progress Tracking
- Weight tracking with visual charts
- Goal setting and monitoring
- Nutrition intake tracking
- Progress history and trends
- Achievement milestones

### 👥 Community Features
- Share recipes and meal ideas
- Create posts with images
- Like and comment on community content
- Follow trending health topics
- Connect with like-minded individuals

### 💎 Premium Features
- Advanced meal planning options
- Exclusive recipes and content
- Priority support
- Enhanced analytics

### 🔐 Security & Authentication
- JWT-based authentication
- Bcrypt password hashing
- Protected API endpoints
- Role-based access control

## 🏗️ Architecture

```
GreenPath/
├── backend/              # Express.js REST API
│   ├── config/          # Database & API configurations
│   ├── controllers/     # Request handlers
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── middleware/      # Auth & validation
│   ├── utils/           # Gemini AI service
│   └── uploads/         # Static file storage
│
└── frontend/            # React + Vite application
    ├── public/          # Static assets
    └── src/
        ├── components/  # Reusable UI components
        ├── pages/       # Page components
        ├── context/     # State management
        └── assets/      # Images & resources
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- npm or yarn
- Docker (optional)

### Option 1: Docker Setup (Recommended)

1. Clone the repository
```bash
git clone https://github.com/yourusername/GreenPath.git
cd GreenPath
```

2. Create environment file
```bash
# Create .env file in backend directory
cd backend
# Add your environment variables (see Environment Variables section)
```

3. Start with Docker Compose
```bash
cd ..
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

### Option 2: Manual Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/GreenPath.git
cd GreenPath
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

4. Setup environment variables (see below)

5. Start MongoDB (if running locally)
```bash
mongod
```

6. Start the backend server
```bash
cd backend
npm run server
```

7. Start the frontend development server
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## ⚙️ Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Database
MONGO_URL=mongodb://localhost:27017/greenpath
# Or use MongoDB Atlas
# MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/greenpath

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this
SALT=10

# Payment Integration (optional)
STRIPE_SECRET_KEY=your_stripe_secret_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Frontend URL (for CORS and redirects)
FRONTEND_URL=http://localhost:5173
```

Create a `.env` file in the `frontend` directory (optional):

```env
VITE_API_URL=http://localhost:4000
```

## 📦 Available Scripts

### Backend
```bash
npm run server          # Start development server with nodemon
npm run server:debug    # Start with debugger
npm run seed            # Seed database with recipes
```

### Frontend
```bash
npm run dev            # Start Vite development server
npm run build          # Build for production
npm run preview        # Preview production build
npm run lint           # Run ESLint
```

## 🛠️ Tech Stack

### Frontend
- **React 18.3.1** - UI library
- **Vite 5.3.4** - Build tool and dev server
- **React Router 6.25.1** - Client-side routing
- **Axios** - HTTP client
- **React Toastify** - Toast notifications
- **Bootstrap Icons** - Icon library

### Backend
- **Node.js** - Runtime environment
- **Express.js 4.19.2** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose 8.5.2** - ODM for MongoDB
- **JWT** - Authentication
- **Bcrypt 5.1.1** - Password hashing
- **Google Generative AI** - AI-powered meal planning
- **Stripe 16.6.0** - Payment processing
- **Multer** - File upload handling
- **Validator** - Input validation

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nodemon** - Development auto-restart

## 📡 API Endpoints

### Authentication
```
POST   /api/user/register      # Register new user
POST   /api/user/login          # User login
GET    /api/user/profile        # Get user profile
```

### Food & Orders
```
GET    /api/food/list           # Get all food items
POST   /api/cart/add            # Add item to cart
POST   /api/order/place         # Place an order
GET    /api/order/user          # Get user orders
```

### Meal Planning
```
POST   /api/meal-plan/generate  # Generate AI meal plan
GET    /api/meal-plan/list      # Get saved meal plans
```

### Recipes
```
GET    /api/recipes/list        # Get all recipes
GET    /api/recipes/:id         # Get recipe details
GET    /api/recipes/category/:name # Filter by category
```

### Weight Tracking
```
POST   /api/weight/add          # Add weight entry
GET    /api/weight/history      # Get weight history
```

### Community
```
GET    /api/posts/list          # Get all posts
POST   /api/posts/create        # Create new post
POST   /api/posts/:id/like      # Like a post
POST   /api/posts/:id/comment   # Comment on post
```

## 🎨 Key Features Implementation

### AI Meal Planning with Gemini
The application integrates Google's Gemini AI to generate personalized meal plans based on:
- User's nutritional goals
- Dietary preferences
- Calorie targets
- Macro distribution
- Meal timing preferences

### Nutrition Tracking
Comprehensive nutrition tracking includes:
- Daily calorie intake
- Macronutrient breakdowns (carbs, protein, fats)
- Micronutrient tracking
- Visual progress charts
- Goal achievement metrics

### Community Engagement
Users can:
- Share their favorite recipes
- Post meal photos and experiences
- Engage with others through likes and comments
- Discover trending health topics
- Build connections in the health community

## 🐳 Docker Deployment

The application includes Docker support for easy deployment:

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Rebuild containers
docker-compose up -d --build
```

## 📊 Database Schema

### Key Models
- **User**: User accounts, preferences, and authentication
- **Food**: Food items with nutritional information
- **Order**: Order records and payment details
- **MealPlan**: Generated meal plans with daily menus
- **Recipe**: Recipe details, ingredients, and instructions
- **Weight**: Weight tracking entries
- **Post**: Community posts with recipes and images

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Gemini AI for intelligent meal planning
- MongoDB for flexible data storage
- React community for excellent documentation
- All contributors and users of GreenPath

## 📧 Contact & Support

For questions, suggestions, or support:
- Create an issue in the repository
- Email: support@greenpath.com
- Documentation: [Wiki](https://github.com/yourusername/GreenPath/wiki)

---

Made with 💚 by the GreenPath Team

