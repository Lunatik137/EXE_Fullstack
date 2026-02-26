# TÀI LIỆU CHỨC NĂNG VÀ CÁC FILE HỆ THỐNG GREENPATH

## MỤC LỤC
1. [Chức năng Người dùng & Xác thực](#1-chức-năng-người-dùng--xác-thực)
2. [Chức năng Onboarding](#2-chức-năng-onboarding)
3. [Chức năng Gói Premium](#3-chức-năng-gói-premium)
4. [Chức năng Lộ trình Ăn chay](#4-chức-năng-lộ-trình-ăn-chay)
5. [Chức năng Công thức](#5-chức-năng-công-thức)
6. [Chức năng Cộng đồng](#6-chức-năng-cộng-đồng)
7. [Chức năng Thông báo](#7-chức-năng-thông-báo)
8. [Chức năng Hồ sơ](#8-chức-năng-hồ-sơ)

---

## 1. CHỨC NĂNG NGƯỜI DÙNG & XÁC THỰC

### Mô tả
Quản lý đăng ký, đăng nhập, xác thực người dùng

### Backend Files

#### `backend/models/userModel.js`
**Chức năng:** Schema MongoDB cho người dùng

**Các trường:**
- `name`: Tên người dùng
- `email`: Email (unique)
- `password`: Mật khẩu đã hash
- `role`: Vai trò (user/admin)
- `cartData`: Dữ liệu giỏ hàng
- `hasCompletedOnboarding`: Đã hoàn thành onboarding chưa
- `onboardingData`: Dữ liệu từ onboarding (tuổi, giới tính, mục tiêu...)
- `planType`: Loại gói ('free' hoặc 'premium')
- `subscriptionStatus`: Trạng thái gói ('active', 'expired', 'cancelled')
- `subscriptionStartDate`: Ngày bắt đầu gói
- `subscriptionEndDate`: Ngày hết hạn gói

#### `backend/controllers/userController.js`
**Chức năng:** Xử lý logic nghiệp vụ người dùng

**Các hàm:**

1. **`loginUser(req, res)`**
   - Đăng nhập người dùng
   - Input: email, password
   - Output: token JWT, role, hasCompletedOnboarding
   - Xác thực password bằng bcrypt

2. **`registerUser(req, res)`**
   - Đăng ký người dùng mới
   - Input: email, password
   - Validate email format
   - Hash password với bcrypt
   - Tạo JWT token

3. **`createToken(id, role)`**
   - Tạo JWT token
   - Input: userId, role
   - Output: JWT token có chứa id và role

4. **`saveOnboarding(req, res)`**
   - Lưu dữ liệu onboarding
   - Input: onboardingData object
   - Cập nhật hasCompletedOnboarding = true

5. **`getUserProfile(req, res)`**
   - Lấy thông tin profile người dùng
   - Output: user data (không có password)

6. **`updateProfile(req, res)`**
   - Cập nhật thông tin profile
   - Input: name, email, phone, location, onboardingData
   - Output: user data đã cập nhật

7. **`selectPlan(req, res)`**
   - Chọn gói free hoặc premium
   - Input: planType ('free' hoặc 'premium')
   - Nếu premium: set subscription dates (30 ngày)

8. **`getCurrentPlan(req, res)`**
   - Lấy thông tin gói hiện tại
   - Output: planType, subscriptionStatus

9. **`confirmPremium(req, res)`**
   - Xác nhận thanh toán premium
   - Set planType = 'premium'
   - Set subscription dates

#### `backend/routes/userRoute.js`
**Chức năng:** Định nghĩa API endpoints cho user

**Các routes:**
- `POST /api/users/register` → registerUser
- `POST /api/users/login` → loginUser
- `POST /api/users/onboarding` → saveOnboarding (có auth)
- `POST /api/users/profile` → getUserProfile (có auth)
- `POST /api/users/update-profile` → updateProfile (có auth)
- `POST /api/users/select-plan` → selectPlan (có auth)
- `GET /api/users/current-plan` → getCurrentPlan (có auth)
- `POST /api/users/confirm-premium` → confirmPremium (có auth)

#### `backend/middleware/auth.js`
**Chức năng:** Middleware xác thực JWT

**Hàm chính:**
- `authMiddleware(req, res, next)`
  - Lấy token từ header
  - Verify token bằng JWT_SECRET
  - Thêm userId vào req.body
  - Cho phép request tiếp tục hoặc reject

### Frontend Files

#### `frontend/src/components/LoginPopup/LoginPopup.jsx`
**Chức năng:** Component modal đăng nhập/đăng ký

**State:**
- `currState`: 'login' hoặc 'signup'
- `data`: {name, email, password}

**Hàm:**
1. **`onLogin(e)`**
   - Submit form đăng nhập/đăng ký
   - Gọi API `/api/users/login` hoặc `/api/users/register`
   - Lưu token vào localStorage
   - Cập nhật context

#### `frontend/src/pages/Landing/Landing.jsx`
**Chức năng:** Trang landing page cho người chưa đăng nhập

**Hàm:**
1. **`handleSignUp()`**
   - Mở modal đăng ký
2. **`handleLogin()`**
   - Mở modal đăng nhập

#### `frontend/src/context/StoreContext.jsx`
**Chức năng:** Context quản lý state toàn ứng dụng

**State:**
- `token`: JWT token
- `showLogin`: Hiển thị modal login
- `hasCompletedOnboarding`: Đã onboarding chưa
- `url`: Backend URL

**Hàm:**
1. **`loadUserData(token)`**
   - Load thông tin user từ token
   - Lấy onboarding status

---

## 2. CHỨC NĂNG ONBOARDING

### Mô tả
Thu thập thông tin người dùng (tuổi, chiều cao, cân nặng, mục tiêu...)

### Backend Files

#### `backend/controllers/userController.js`
**Hàm:** `saveOnboarding(req, res)` (đã mô tả ở trên)

### Frontend Files

#### `frontend/src/pages/Onboarding/Onboarding.jsx`
**Chức năng:** Form onboarding nhiều bước

**State:**
- `currentStep`: Bước hiện tại (0-6)
- `formData`: Dữ liệu form các bước
  - age, gender, height, weight
  - goal, targetWeight, targetDuration
  - healthConditions, dietType
  - allergies, dislikes
  - activityLevel

**Hàm:**
1. **`handleNext()`**
   - Validate dữ liệu bước hiện tại
   - Chuyển sang bước tiếp theo

2. **`handleBack()`**
   - Quay lại bước trước

3. **`handleComplete()`**
   - Submit toàn bộ dữ liệu onboarding
   - Gọi API `/api/users/onboarding`
   - Redirect đến `/plan-price`

4. **`handleInputChange(e)`**
   - Cập nhật formData khi user nhập

5. **`toggleArrayValue(array, value)`**
   - Toggle value trong array (cho checkbox)

---

## 3. CHỨC NĂNG GỐI PREMIUM

### Mô tả
Quản lý gói free/premium, thanh toán

### Backend Files

#### `backend/controllers/userController.js`
**Các hàm:** 
- `selectPlan(req, res)` - Chọn gói
- `getCurrentPlan(req, res)` - Lấy gói hiện tại
- `confirmPremium(req, res)` - Xác nhận thanh toán

### Frontend Files

#### `frontend/src/pages/PlanPrice/PlanPrice.jsx`
**Chức năng:** Trang chọn gói sau onboarding

**State:**
- `selectedPlan`: 'free' hoặc 'premium'
- `isLoading`: Đang xử lý

**Hàm:**
1. **`handleSelectPlan(plan)`**
   - Chọn gói free hoặc premium

2. **`handleConfirm()`**
   - Lưu lựa chọn gói
   - Gọi API `/api/users/select-plan`
   - Nếu free: đi đến `/home`
   - Nếu premium: đi đến `/payment`

#### `frontend/src/pages/Payment/Payment.jsx`
**Chức năng:** Trang thanh toán premium (placeholder)

**State:**
- `isProcessing`: Đang xử lý thanh toán

**Hàm:**
1. **`handleMockPayment()`**
   - Giả lập thanh toán (2 giây)
   - Gọi API `/api/users/confirm-premium`
   - Redirect đến `/home`

2. **`handleCancel()`**
   - Hủy thanh toán, quay về `/plan-price`

#### `frontend/src/pages/PlanSelection/PlanSelection.jsx`
**Chức năng:** Chọn thời lượng lộ trình (7-90 ngày)

**State:**
- `selectedDuration`: Thời lượng đã chọn
- `userPlan`: Gói hiện tại của user
- `isLoading`: Đang load

**Hàm:**
1. **`fetchUserPlan()`**
   - Lấy gói hiện tại từ API `/api/users/current-plan`

2. **`handleContinue()`**
   - Chuyển đến `/generate-plan` với duration

#### `frontend/src/components/Sidebar/Sidebar.jsx`
**Chức năng:** Sidebar navigation

**State:**
- `userPlan`: Gói hiện tại
- `showPremiumModal`: Hiển thị modal premium

**Hàm:**
1. **`fetchUserPlan()`**
   - Lấy gói từ API `/api/users/current-plan`
   - Re-fetch khi pathname thay đổi

2. **Điều kiện hiển thị:**
   - Chỉ hiện Premium section nếu `userPlan === 'free'`

---

## 4. CHỨC NĂNG LỘ TRÌNH ĂN CHAY

### Mô tả
Tạo lộ trình ăn chay cá nhân hóa bằng AI

### Backend Files

#### `backend/models/mealPlanModel.js`
**Chức năng:** Schema lộ trình ăn chay

**Các trường:**
- `userId`: Ref đến User
- `planType`: 'free' hoặc 'premium'
- `duration`: Số ngày
- `status`: 'draft' hoặc 'active'
- `days`: Array các ngày
  - `day`: Số ngày
  - `date`: Ngày thực tế
  - `meals`: {breakfast, lunch, dinner}
    - `recipeId`: Ref đến Recipe
    - `recipeName`, `calories`, `protein`, etc.

#### `backend/controllers/mealPlanController.js`
**Chức năng:** Xử lý logic lộ trình

**Các hàm:**

1. **`generateMealPlan(req, res)`**
   - Tạo lộ trình mới bằng AI
   - Input: planType, duration
   - Lấy onboarding data
   - Tính calories cần thiết
   - Lọc recipes phù hợp (allergies...)
   - Gọi Gemini AI với prompt
   - Parse JSON response
   - Lưu vào database với status='draft'

2. **`confirmMealPlan(req, res)`**
   - Xác nhận lộ trình draft
   - Chuyển status='active'
   - Deactivate các plan cũ

3. **`getDraftMealPlan(req, res)`**
   - Lấy lộ trình draft nếu có

4. **`getActiveMealPlan(req, res)`**
   - Lấy lộ trình active
   - Populate recipe refs

5. **`getTodayMeal(req, res)`**
   - Lấy bữa ăn hôm nay
   - Tính ngày dựa vào startDate

6. **`getAllMealPlans(req, res)`**
   - Lấy tất cả lộ trình của user

#### `backend/routes/mealPlanRoute.js`
**Các routes:**
- `POST /api/meal-plan/generate` → generateMealPlan (có auth)
- `POST /api/meal-plan/confirm` → confirmMealPlan (có auth)
- `POST /api/meal-plan/get-draft` → getDraftMealPlan (có auth)
- `POST /api/meal-plan/active` → getActiveMealPlan (có auth)
- `POST /api/meal-plan/today` → getTodayMeal (có auth)
- `POST /api/meal-plan/all` → getAllMealPlans (có auth)

#### `backend/utils/geminiService.js`
**Chức năng:** Service tích hợp Gemini AI

**Class:** `GeminiService`

**Các hàm:**

1. **`constructor()`**
   - Khởi tạo GoogleGenAI client
   - Load API keys

2. **`validateAndInitialize()`**
   - Validate API keys
   - Initialize client

3. **`initializeClient()`**
   - Tạo GoogleGenAI instance với API key

4. **`generateMealPlan(prompt)`**
   - Gọi Gemini API
   - Retry với các keys khác nếu fail
   - Handle timeout (60s)
   - Handle errors (404, 503, 429, timeout)
   - Return JSON text

5. **`generateContent(prompt)`**
   - Alias cho generateMealPlan

#### `backend/config/geminiKeys.js`
**Chức năng:** Quản lý API keys Gemini

**Class:** `GeminiKeyManager`

**Các hàm:**
1. **`loadKeys()`** - Load keys từ .env
2. **`hasValidKeys()`** - Check có key hợp lệ
3. **`getCurrentKey()`** - Lấy key hiện tại
4. **`rotateKey()`** - Chuyển sang key tiếp theo
5. **`isPlaceholderKey(key)`** - Check key có phải placeholder

### Frontend Files

#### `frontend/src/pages/MealPlanPreview/MealPlanPreview.jsx`
**Chức năng:** Preview và tạo lộ trình

**State:**
- `loading`: Đang tạo
- `mealPlan`: Dữ liệu lộ trình
- `currentWeek`: Tuần hiện tại
- `loadingSeconds`: Đếm giây loading

**Hàm:**

1. **`fetchDraftMealPlan()`**
   - Lấy draft plan
   - Gọi API `/api/meal-plan/get-draft`

2. **`generateMealPlan()`**
   - Tạo lộ trình mới
   - Gọi API `/api/meal-plan/generate`
   - Lưu vào localStorage

3. **`handleConfirm()`**
   - Xác nhận lộ trình
   - Gọi API `/api/meal-plan/confirm`
   - Redirect `/home`

4. **`handleRegenerate()`**
   - Tạo lại lộ trình
   - Clear localStorage
   - Gọi generateMealPlan()

5. **`handlePrevWeek()`, `handleNextWeek()`**
   - Chuyển tuần

6. **`getCurrentWeekDays()`**
   - Lấy 7 ngày của tuần hiện tại

#### `frontend/src/components/TodayMenu/TodayMenu.jsx`
**Chức năng:** Hiển thị thực đơn hôm nay

**Props:**
- `mealPlan`: Lộ trình active
- `todayMeal`: Bữa ăn hôm nay
- `loading`: Đang load

**Hàm:**

1. **`handleRecipeClick(recipeId)`**
   - Navigate đến recipe detail

2. **`setupMealReminders()`**
   - Setup thông báo nhắc bữa ăn
   - Request permission
   - Subscribe notifications
   - Set timeout cho 7am, 12pm, 6pm

**Render:**
- Loading skeleton
- No plan → Button "Tạo lộ trình ngay"
- No meal today
- Today's meals (breakfast, lunch, dinner)

#### `frontend/src/pages/Home/Home.jsx`
**Chức năng:** Trang chủ

**State:**
- `activeMealPlan`: Lộ trình active
- `todayMeal`: Bữa hôm nay
- `loading`: Đang load

**Hàm:**

1. **`fetchActiveMealPlan()`**
   - Gọi API `/api/meal-plan/active`

2. **`fetchTodayMeal()`**
   - Gọi API `/api/meal-plan/today`

---

## 5. CHỨC NĂNG CÔNG THỨC

### Mô tả
Quản lý thư viện công thức nấu ăn chay

### Backend Files

#### `backend/models/recipeModel.js`
**Chức năng:** Schema công thức

**Các trường:**
- `name`: Tên món
- `category`: Danh mục
- `image`: URL ảnh
- `prepTime`, `cookTime`, `totalTime`: Thời gian
- `servings`: Số người ăn
- `difficulty`: Độ khó
- `dietType`: Loại chay
- `ingredients`: Array nguyên liệu
- `instructions`: Array bước làm
- `nutrition`: {calories, protein, carbs, fat, fiber}
- `tags`: Array tags
- `isVegan`, `isGlutenFree`: Boolean

#### `backend/controllers/recipeController.js`
**Chức năng:** Logic công thức

**Các hàm:**

1. **`addRecipe(req, res)`**
   - Thêm công thức mới
   - Input: recipe data + image
   - Upload image

2. **`listRecipes(req, res)`**
   - Lấy danh sách recipes
   - Support filtering (category, tags)
   - Support search

3. **`getRecipeById(req, res)`**
   - Lấy chi tiết recipe

4. **`updateRecipe(req, res)`**
   - Cập nhật recipe

5. **`deleteRecipe(req, res)`**
   - Xóa recipe

6. **`searchRecipes(req, res)`**
   - Tìm kiếm recipes
   - Search trong name, ingredients, tags

#### `backend/routes/recipeRoute.js`
**Các routes:**
- `POST /api/recipes/add` → addRecipe (có auth admin)
- `GET /api/recipes/list` → listRecipes
- `GET /api/recipes/:id` → getRecipeById
- `PUT /api/recipes/:id` → updateRecipe (có auth admin)
- `DELETE /api/recipes/:id` → deleteRecipe (có auth admin)
- `GET /api/recipes/search` → searchRecipes

### Frontend Files

#### `frontend/src/pages/RecipeLibrary/RecipeLibrary.jsx`
**Chức năng:** Thư viện công thức

**State:**
- `recipes`: Danh sách recipes
- `filteredRecipes`: Recipes sau filter
- `selectedCategory`: Category đã chọn
- `searchQuery`: Query tìm kiếm
- `selectedRecipe`: Recipe được chọn để xem detail

**Hàm:**

1. **`fetchRecipes()`**
   - Gọi API `/api/recipes/list`

2. **`handleSearch(query)`**
   - Filter recipes local

3. **`handleCategoryFilter(category)`**
   - Filter theo category

4. **`handleRecipeClick(recipe)`**
   - Mở modal detail

#### `frontend/src/components/RecipeCard/RecipeCard.jsx`
**Chức năng:** Card hiển thị recipe

**Props:**
- `recipe`: Dữ liệu recipe
- `onClick`: Handler khi click

#### `frontend/src/components/RecipeDetailModal/RecipeDetailModal.jsx`
**Chức năng:** Modal chi tiết recipe

**Props:**
- `recipe`: Recipe data
- `isOpen`: Mở/đóng
- `onClose`: Handler đóng

**Tabs:**
- Ingredients
- Instructions
- Nutrition

---

## 6. CHỨC NĂNG CỘNG ĐỒNG

### Mô tả
Mạng xã hội nội bộ - đăng bài, comment, like

### Backend Files

#### `backend/models/postModel.js`
**Chức năng:** Schema bài đăng

**Các trường:**
- `userId`: Ref User
- `content`: Nội dung
- `images`: Array URLs
- `hashtags`: Array hashtags
- `likes`: Array userIds
- `likesCount`: Số likes
- `commentsCount`: Số comments

#### `backend/models/commentModel.js`
**Chức năng:** Schema comment

**Các trường:**
- `postId`: Ref Post
- `userId`: Ref User
- `content`: Nội dung comment

#### `backend/controllers/postController.js`
**Chức năng:** Logic bài đăng

**Các hàm:**

1. **`createPost(req, res)`**
   - Tạo bài đăng mới
   - Input: content, images
   - Extract hashtags

2. **`getPosts(req, res)`**
   - Lấy danh sách posts
   - Populate user info
   - Sort theo thời gian

3. **`getPostById(req, res)`**
   - Lấy chi tiết post

4. **`likePost(req, res)`**
   - Toggle like/unlike
   - Gửi notification (nếu like)

5. **`addComment(req, res)`**
   - Thêm comment
   - Tăng commentsCount
   - Gửi notification

6. **`getComments(req, res)`**
   - Lấy comments của post
   - Populate user info

7. **`updateComment(req, res)`**
   - Sửa comment

8. **`deleteComment(req, res)`**
   - Xóa comment
   - Giảm commentsCount

9. **`deletePost(req, res)`**
   - Xóa post

#### `backend/routes/postRoute.js`
**Các routes:**
- `POST /api/posts/create` → createPost (có auth)
- `GET /api/posts` → getPosts
- `GET /api/posts/:id` → getPostById
- `POST /api/posts/:id/like` → likePost (có auth)
- `POST /api/posts/:id/comments` → addComment (có auth)
- `GET /api/posts/:id/comments` → getComments
- `PUT /api/posts/:postId/comment/:commentId` → updateComment (có auth)
- `DELETE /api/posts/:postId/comment/:commentId` → deleteComment (có auth)
- `DELETE /api/posts/:id` → deletePost (có auth)

### Frontend Files

#### `frontend/src/pages/Community/Community.jsx`
**Chức năng:** Trang cộng đồng

**State:**
- `posts`: Danh sách bài đăng
- `isCreatingPost`: Đang tạo bài
- `newPostContent`: Nội dung bài mới
- `trendingTopics`: Hashtags thịnh hành

**Hàm:**

1. **`fetchPosts()`**
   - Gọi API `/api/posts`

2. **`handleCreatePost()`**
   - Mở form tạo bài

3. **`handleSubmitPost()`**
   - Submit bài mới
   - Gọi API `/api/posts/create`

4. **`handleLikePost(postId)`**
   - Like/unlike post
   - Gọi API `/api/posts/:id/like`

#### `frontend/src/components/PostCard/PostCard.jsx`
**Chức năng:** Card hiển thị bài đăng

**Props:**
- `post`: Dữ liệu post
- `onLikePost`: Handler like

**State:**
- `isLiked`: Đã like chưa
- `likeCount`: Số likes
- `comments`: Danh sách comments
- `showComments`: Hiển thị comments
- `commentText`: Text comment mới
- `editingCommentId`: Comment đang edit

**Hàm:**

1. **`handleLike()`**
   - Toggle like
   - Gọi onLikePost
   - Gửi notification

2. **`fetchComments()`**
   - Gọi API `/api/posts/:id/comments`

3. **`handleCommentSubmit()`**
   - Submit comment
   - Gọi API `/api/posts/:id/comments`
   - Gửi notification

4. **`handleEditStart(comment)`**
   - Bắt đầu edit comment

5. **`handleEditSave(commentId)`**
   - Lưu comment đã edit
   - Gọi API `PUT /api/posts/:postId/comment/:commentId`

6. **`handleDeleteComment(commentId)`**
   - Xóa comment
   - Gọi API `DELETE /api/posts/:postId/comment/:commentId`

7. **`formatTimeAgo(date)`**
   - Format thời gian (vừa xong, 2 phút trước...)

#### `frontend/src/components/CreatePost/CreatePost.jsx`
**Chức năng:** Form tạo bài đăng

**Props:**
- `onSubmit`: Handler submit
- `onCancel`: Handler hủy

**State:**
- `content`: Nội dung bài
- `images`: Array ảnh

**Hàm:**

1. **`handleImageUpload(e)`**
   - Upload ảnh

2. **`handleSubmit()`**
   - Validate + submit

---

## 7. CHỨC NĂNG THÔNG BÁO

### Mô tả
Push notifications cho meal reminders, comments, likes

### Backend Files

#### `backend/models/notificationSubscriptionModel.js`
**Chức năng:** Schema subscription

**Các trường:**
- `userId`: Ref User
- `endpoint`: Push endpoint (unique)
- `keys`: {p256dh, auth}
- `userAgent`: Browser info

#### `backend/controllers/notificationController.js`
**Chức năng:** Logic notifications

**Các hàm:**

1. **`subscribeUser(req, res)`**
   - Lưu subscription từ frontend
   - Input: subscription object

2. **`unsubscribeUser(req, res)`**
   - Xóa subscription

3. **`sendNotificationToUser(userId, payload)`**
   - Gửi push notification đến user
   - Lấy tất cả subscriptions của user
   - Gọi web-push
   - Xóa subscriptions expired

4. **`notifyNewComment(userId, commenterName, postPreview)`**
   - Gửi notification comment mới

5. **`notifyNewLike(userId, likerName, postPreview)`**
   - Gửi notification like mới

6. **`notifyMealSchedule(userId, mealName, mealTime)`**
   - Gửi notification nhắc bữa ăn

#### `backend/routes/notificationRoute.js`
**Các routes:**
- `POST /api/notifications/subscribe` → subscribeUser (có auth)
- `POST /api/notifications/unsubscribe` → unsubscribeUser (có auth)

### Frontend Files

#### `frontend/src/services/notificationService.js`
**Chức năng:** Service quản lý notifications

**Class:** `NotificationService`

**Các hàm:**

1. **`init()`**
   - Register service worker
   - Check browser support

2. **`requestPermission()`**
   - Request notification permission

3. **`subscribe()`**
   - Subscribe to push notifications
   - Lấy VAPID key
   - Gọi pushManager.subscribe()
   - Lưu subscription lên backend

4. **`unsubscribe()`**
   - Unsubscribe
   - Xóa khỏi backend

5. **`saveSubscription(subscription)`**
   - Gọi API `/api/notifications/subscribe`

6. **`removeSubscription(subscription)`**
   - Gọi API `/api/notifications/unsubscribe`

7. **`showNotification(title, options)`**
   - Hiển thị notification

8. **`notifyMealSchedule(mealName, mealTime)`**
   - Show meal reminder

9. **`notifyNewComment(userName, postPreview)`**
   - Show comment notification

10. **`notifyNewLike(userName, postPreview)`**
    - Show like notification

11. **`urlBase64ToUint8Array(base64String)`**
    - Convert VAPID key

#### `frontend/public/service-worker.js`
**Chức năng:** Service Worker xử lý push events

**Events:**

1. **`push`**
   - Nhận push notification
   - Parse data
   - Show notification

2. **`notificationclick`**
   - User click notification
   - Navigate đến page tương ứng
   - Community (comment/like) hoặc Home (meal)

3. **`notificationclose`**
   - User đóng notification

---

## 8. CHỨC NĂNG HỒ SƠ

### Mô tả
Quản lý thông tin cá nhân, cân nặng, mục tiêu

### Backend Files

#### `backend/controllers/userController.js`
**Các hàm:**
- `getUserProfile(req, res)` - Lấy profile
- `updateProfile(req, res)` - Cập nhật profile

### Frontend Files

#### `frontend/src/pages/Profile/Profile.jsx`
**Chức năng:** Trang hồ sơ cá nhân

**State:**
- `userData`: Dữ liệu user
- `formData`: Dữ liệu form edit
- `isEditing`: Đang edit hay không
- `activeTab`: Tab hiện tại (overview/onboarding/settings)
- `weightHistory`: Lịch sử cân nặng

**Hàm:**

1. **`fetchUserData()`**
   - Gọi API `/api/users/profile`

2. **`handleEdit()`**
   - Bật chế độ edit

3. **`handleSave()`**
   - Lưu thay đổi
   - Gọi API `/api/users/update-profile`

4. **`handleCancel()`**
   - Hủy edit

5. **`handleInputChange(field, value)`**
   - Cập nhật formData

6. **`handleLogout()`**
   - Xóa token
   - Redirect landing page

**Tabs:**
- **Overview**: Thông tin cơ bản, BMI, mục tiêu
- **Onboarding**: Dữ liệu onboarding (có thể edit)
- **Settings**: Cài đặt (chưa implement)

#### `frontend/src/components/ProgressTracker/ProgressTracker.jsx`
**Chức năng:** Biểu đồ tiến độ cân nặng

**Props:**
- `weightHistory`: Array {date, weight}
- `currentWeight`: Cân nặng hiện tại
- `targetWeight`: Cân nặng mục tiêu

**Render:**
- Line chart cân nặng theo thời gian
- Progress percentage

#### `frontend/src/components/NutritionStats/NutritionStats.jsx`
**Chức năng:** Thống kê dinh dưỡng

**Props:**
- `nutrition`: {calories, protein, carbs, fat}

**Render:**
- Circular progress charts
- Nutrition breakdown

---

## CÁC FILE TIỆN ÍCH

### `backend/config/db.js`
**Chức năng:** Kết nối MongoDB

**Hàm:**
- `connectDB()` - Connect to MongoDB using MONGODB_URI

### `backend/config/geminiKeys.js`
**Chức năng:** Quản lý Gemini API keys (đã mô tả ở trên)

### `frontend/src/assets/assets.js`
**Chức năng:** Export static assets (images, icons)

### `frontend/src/index.css`
**Chức năng:** Global CSS styles

### `frontend/src/App.css`
**Chức năng:** App-level CSS

---

## FLOW CHÍNH CỦA ỨNG DỤNG

### 1. User mới đăng ký
```
Landing → Register → Login → Onboarding (7 bước) → 
PlanPrice (chọn Free/Premium) → 
[Nếu Premium: Payment] → 
Home (chưa có lộ trình) → 
PlanSelection (chọn duration) → 
MealPlanPreview (AI tạo) → 
Confirm → Home (có lộ trình)
```

### 2. User đã có lộ trình
```
Login → Home (hiển thị TodayMenu + ProgressTracker)
```

### 3. User tạo lộ trình mới
```
Home → Click "Tạo lộ trình ngay" → 
PlanSelection → MealPlanPreview → Confirm
```

### 4. User nâng cấp Premium
```
Sidebar → Click "Nâng cấp ngay" → 
Modal Premium → Click "Đăng ký ngay" → 
Payment → Confirm → Home (Premium section ẩn)
```

### 5. User tương tác cộng đồng
```
Community → Xem posts → 
Like/Comment → Notification gửi đến post creator
```

---

## ENVIRONMENT VARIABLES CẦN THIẾT

### Backend (.env)
```
PORT=4000
MONGODB_URI=mongodb://...
JWT_SECRET=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_MAILTO=mailto:...
GEMINI_KEY_1=...
GEMINI_KEY_2=...
GEMINI_KEY_3=...
```

### Frontend (.env.local)
```
VITE_VAPID_PUBLIC_KEY=...
VITE_API_URL=http://localhost:4000
```

---

## CÔNG NGHỆ SỬ DỤNG

### Backend
- **Node.js** + **Express**: Server
- **MongoDB** + **Mongoose**: Database
- **JWT**: Authentication
- **bcrypt**: Password hashing
- **Gemini AI**: Meal plan generation
- **web-push**: Push notifications
- **multer**: File upload

### Frontend
- **React 18**: UI framework
- **React Router**: Routing
- **Axios**: HTTP client
- **React Toastify**: Toast notifications
- **Vite**: Build tool
- **Service Workers**: Push notifications

---

## KẾT LUẬN

Tài liệu này liệt kê đầy đủ các chức năng, files, và functions trong hệ thống GreenPath. Mỗi section mô tả rõ:
- Chức năng là gì
- File nào chứa code
- Các hàm trong file đó làm gì
- Input/Output của mỗi hàm
- Mối quan hệ giữa backend và frontend

Sử dụng tài liệu này để:
- Hiểu kiến trúc hệ thống
- Tìm nhanh file cần sửa
- Onboard developer mới
- Debug issues
- Mở rộng tính năng
