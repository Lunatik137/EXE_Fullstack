import { useState } from 'react';
import './RecipeLibrary.css';
import RecipeCategories from '../../components/RecipeCategories/RecipeCategories';
import RecipeCard from '../../components/RecipeCard/RecipeCard';

const RecipeLibrary = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [activeTab, setActiveTab] = useState('ingredients');

  // Category names mapping
  const categoryNames = {
    'all': 'ăn',
    'xao': 'xào',
    'luoc': 'luộc',
    'nuong': 'nướng',
    'chien': 'chiên',
    'hap': 'hấp',
    'kho': 'kho',
    'canh': 'canh',
    'goi': 'gỏi',
    'lau': 'lẩu'
  };

  // Sample recipes data
  const recipes = [
    {
      id: 1,
      title: 'Đậu hũ xào sả ớt',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop',
      cookTime: '15p',
      rating: 4.8,
      ratingCount: 620,
      category: 'xao',
      servings: '2 người',
      ingredients: [
        { name: 'Đậu hũ trắng', amount: '200g' },
        { name: 'Sả băm', amount: '2 muỗng' },
        { name: 'Ớt', amount: '1 quả' },
        { name: 'Nước tương', amount: '1 muỗng' },
        { name: 'Dầu ăn', amount: '1 muỗng' }
      ],
      steps: [
        'Làm nóng chảo và phi sả cho thơm vàng.',
        'Cho đậu hũ cắt miếng vào áp chảo đến khi vàng nhẹ các mặt.',
        'Thêm ớt, nước tương, gia vị. Đảo đều trên lửa nhỏ.',
        'Rim 2-3 phút cho thấm rồi tắt bếp. Dùng nóng với cơm trắng.'
      ],
      comments: [
        { author: 'Minh Anh', text: 'Món này làm nhanh mà ngon. Hợp ăn healthy!', avatar: 'https://ui-avatars.com/api/?name=Minh+Anh&background=3498db&color=fff' },
        { author: 'Tuấn Vegan', text: 'Thêm chút dầu mè cuối cùng là thơm bùng nổ luôn nha mọi người!!', avatar: 'https://ui-avatars.com/api/?name=Tuan+Vegan&background=9b59b6&color=fff' }
      ]
    },
    {
      id: 2,
      title: 'Rau củ xào tháp cẩm',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop',
      cookTime: '20p',
      rating: 4.5,
      ratingCount: 120,
      category: 'xao',
      servings: '3 người',
      ingredients: [
        { name: 'Bông cải xanh', amount: '150g' },
        { name: 'Cà rót', amount: '100g' },
        { name: 'Nấm hương', amount: '50g' },
        { name: 'Tỏi băm', amount: '2 tép' }
      ],
      steps: [
        'Sơ chế rau củ, rửa sạch, cắt vừa ăn',
        'Phi tỏi thơm, cho rau củ vào xào nhanh tay',
        'Nêm nếm gia vị cho vừa khẩu vị',
        'Tắt bếp, bày đĩa và thưởng thức'
      ],
      comments: []
    },
    {
      id: 3,
      title: 'Canh chua nấm đậu hũ',
      image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop',
      cookTime: '25p',
      rating: 4.7,
      ratingCount: 340,
      category: 'canh',
      servings: '4 người',
      ingredients: [
        { name: 'Nấm rơm', amount: '200g' },
        { name: 'Đậu hũ', amount: '150g' },
        { name: 'Cà chua', amount: '2 quả' },
        { name: 'Me', amount: '1 muỗng' }
      ],
      steps: [
        'Nấu nước sôi, cho me và cà chua vào',
        'Thêm nấm và đậu hũ đã cắt',
        'Nêm nếm chua ngọt vừa miệng',
        'Cho rau thơm và tắt bếp'
      ],
      comments: []
    },
    {
      id: 4,
      title: 'Phở chay nước dùng rau củ',
      image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600&auto=format&fit=crop',
      cookTime: '40p',
      rating: 4.9,
      ratingCount: 580,
      category: 'luoc',
      servings: '2 người',
      ingredients: [
        { name: 'Bánh phở', amount: '300g' },
        { name: 'Nấm đùi gà', amount: '100g' },
        { name: 'Rau thơm', amount: '1 bó' }
      ],
      steps: [
        'Nấu nước dùng từ rau củ thơm ngon',
        'Trần bánh phở qua nước sôi',
        'Cho bánh phở vào tô, thêm nấm',
        'Chan nước dùng nóng, thêm rau'
      ],
      comments: []
    }
  ];

  const filteredRecipes = recipes.filter(recipe => {
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setActiveTab('ingredients');
  };

  const handleAddToMenu = () => {
    if (selectedRecipe) {
      alert(`Đã thêm "${selectedRecipe.title}" vào thực đơn!`);
    }
  };

  return (
    <div className="recipe-library-page">
      <div className="library-sidebar">
        <div className="library-header">
          <h1>Từ Khóa Thịnh Hành</h1>
          <div className="search-box">
            <input
              type="text"
              placeholder="Tìm tên món hay nguyên liệu"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && console.log('Search:', searchQuery)}
            />
            <button className="search-icon" onClick={() => console.log('Search:', searchQuery)}>
              Tìm Kiếm
            </button>
          </div>
        </div>

        <RecipeCategories onCategoryChange={setSelectedCategory} />

        <div className="popular-section">
          <h2>Món {categoryNames[selectedCategory] || 'ăn'} hấp dẫn</h2>
          <div className="recipe-grid">
            {filteredRecipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} onClick={handleRecipeClick} />
            ))}
          </div>
        </div>
      </div>

      {selectedRecipe && (
        <div className="recipe-detail-section">
          <button className="back-btn" onClick={() => setSelectedRecipe(null)}>
            ← Quay lại
          </button>
          
          <div className="recipe-detail-hero">
            <img src={selectedRecipe.image} alt={selectedRecipe.title} />
            <div className="recipe-detail-overlay">
              <h1>{selectedRecipe.title}</h1>
              <div className="recipe-stats">
                <span>❤️ {selectedRecipe.ratingCount}</span>
                <span>👤 {selectedRecipe.servings}</span>
              </div>
            </div>
          </div>

          <div className="recipe-tabs">
            <button
              className={`tab ${activeTab === 'ingredients' ? 'active' : ''}`}
              onClick={() => setActiveTab('ingredients')}
            >
              Nguyên liệu
            </button>
            <button
              className={`tab ${activeTab === 'instructions' ? 'active' : ''}`}
              onClick={() => setActiveTab('instructions')}
            >
              Cách làm
            </button>
            <button
              className={`tab ${activeTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              Bình luận
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'ingredients' && (
              <div className="ingredients-tab">
                <h3>Thành phần chính</h3>
                <div className="ingredients-list-detail">
                  {selectedRecipe.ingredients.map((ingredient, index) => (
                    <div key={index} className="ingredient-row">
                      <span className="ingredient-name-detail">{ingredient.name}</span>
                      <span className="ingredient-amount-detail">{ingredient.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'instructions' && (
              <div className="instructions-tab">
                <h3>Cách chế biến</h3>
                <div className="steps-list">
                  {selectedRecipe.steps.map((step, index) => (
                    <div key={index} className="step-item">
                      <div className="step-number-badge">{index + 1}</div>
                      <p>{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="comments-tab">
                <h3>Bình luận nổi bật</h3>
                {selectedRecipe.comments.length > 0 ? (
                  selectedRecipe.comments.map((comment, index) => (
                    <div key={index} className="comment-box">
                      <img src={comment.avatar} alt={comment.author} />
                      <div>
                        <p className="comment-author-name">{comment.author}</p>
                        <p className="comment-text-detail">{comment.text}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-comments">Chưa có bình luận nào</p>
                )}
              </div>
            )}
          </div>

          <div className="recipe-actions-bar">
            <button className="favorite-btn">
              <span>🤍</span> Yêu thích
            </button>
            <button className="add-menu-btn" onClick={handleAddToMenu}>
              Thêm vào thực đơn
            </button>
            <button className="share-btn-detail">
              <span>📤</span> Chia sẻ
            </button>
          </div>
        </div>
      )}

      {!selectedRecipe && (
        <div className="no-recipe-selected">
          <div className="empty-state">
            <span className="empty-icon">🍳</span>
            <h2>Chọn một công thức để xem chi tiết</h2>
            <p>Khám phá hàng trăm công thức chay ngon và lành mạnh</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeLibrary;
