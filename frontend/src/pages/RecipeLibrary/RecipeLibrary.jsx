import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './RecipeLibrary.css';
import RecipeCategories from '../../components/RecipeCategories/RecipeCategories';
import RecipeCard from '../../components/RecipeCard/RecipeCard';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';

const RecipeLibrary = () => {
  const { url } = useContext(StoreContext);
  const { id: recipeId } = useParams();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [activeTab, setActiveTab] = useState('ingredients');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category names mapping
  const categoryNames = {
    'all': 'ăn',
    'xao': 'xào',
    'luoc': 'luộc',
    'nuong': 'nướng',
    'kho': 'kho',
    'canh': 'canh',
    'tron': 'trộn',
    'hap': 'hấp',
    'chien': 'chiên giòn'
  };

  useEffect(() => {
    fetchRecipes();
  }, [selectedCategory]);

  // Fetch specific recipe if recipeId is in URL
  useEffect(() => {
    if (recipeId) {
      fetchRecipeById(recipeId);
    }
  }, [recipeId]);

  const fetchRecipeById = async (id) => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/recipes/${id}`);
      
      if (response.data.success) {
        setSelectedRecipe(response.data.recipe);
        setActiveTab('ingredients');
      }
    } catch (error) {
      console.error('Error fetching recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      let endpoint = `${url}/api/recipes/all`;
      
      if (selectedCategory && selectedCategory !== 'all') {
        endpoint = `${url}/api/recipes/method/${selectedCategory}`;
      }
      
      const response = await axios.get(endpoint);
      
      if (response.data.success) {
        setRecipes(response.data.recipes);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setActiveTab('ingredients');
  };

  const handleAddToMenu = () => {
    if (selectedRecipe) {
      alert(`Đã thêm "${selectedRecipe.name}" vào thực đơn!`);
    }
  };

  return (
    <div className="recipe-library-page">
      {!selectedRecipe && (
        <div className="library-sidebar">
          <div className="library-header">
            <h1>Thư viện công thức</h1>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Tìm kiếm công thức..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <RecipeCategories onCategoryChange={setSelectedCategory} />

          <div className="popular-section">
            <h2>Món {categoryNames[selectedCategory] || 'ăn'} hấp dẫn</h2>
            {loading ? (
              <div className="loading">Đang tải công thức...</div>
            ) : (
              <div className="recipe-grid">
                {filteredRecipes.map(recipe => (
                  <div key={recipe._id} className="recipe-card-item" onClick={() => handleRecipeClick(recipe)}>
                    <div className="recipe-image">
                      <img src={recipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop'} alt={recipe.name} />
                    </div>
                    <div className="recipe-content">
                      <h3>{recipe.name}</h3>
                      <div className="recipe-meta">
                        <span>⏱️ {recipe.prepTime + recipe.cookTime}p</span>
                        <span>🔥 {recipe.calories} kcal</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedRecipe && (
        <div className="recipe-detail-section">
          <button className="back-btn" onClick={() => {
            if (recipeId) {
              navigate('/recipes');
            } else {
              setSelectedRecipe(null);
            }
          }}>
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
                <h3>Nguyên liệu cần chuẩn bị</h3>
                <div className="ingredients-list-detail">
                  {selectedRecipe.ingredients.map((ingredient, index) => (
                    <div key={index} className="ingredient-row">
                      <span className="ingredient-bullet">✓</span>
                      <span className="ingredient-name-detail">{ingredient}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'instructions' && (
              <div className="instructions-tab">
                <h3>Cách chế biến</h3>
                <div className="steps-list">
                  {selectedRecipe.instructions.map((step, index) => (
                    <div key={index} className="step-item">
                      <div className="step-number-badge">{index + 1}</div>
                      <p>{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'nutrition' && (
              <div className="nutrition-tab">
                <h3>Thông tin dinh dưỡng (trên khẩu phần)</h3>
                <div className="nutrition-grid">
                  <div className="nutrition-item">
                    <span className="nutrition-label">Calories</span>
                    <span className="nutrition-value">{selectedRecipe.calories} kcal</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrition-label">Protein</span>
                    <span className="nutrition-value">{selectedRecipe.protein}g</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrition-label">Carbs</span>
                    <span className="nutrition-value">{selectedRecipe.carbs}g</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrition-label">Chất béo</span>
                    <span className="nutrition-value">{selectedRecipe.fat}g</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="nutrition-label">Chất xơ</span>
                    <span className="nutrition-value">{selectedRecipe.fiber}g</span>
                  </div>
                </div>
                
                {selectedRecipe.allergens && selectedRecipe.allergens.length > 0 && (
                  <div className="allergens-section">
                    <h4>⚠️ Chú ý dị ứng:</h4>
                    <div className="allergens-list">
                      {selectedRecipe.allergens.map((allergen, index) => (
                        <span key={index} className="allergen-tag">{allergen}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="recipe-actions-bar">
            <button className="favorite-btn">
              <span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg></span> Yêu thích
            </button>
            <button className="add-menu-btn" onClick={handleAddToMenu}>
              Thêm vào thực đơn
            </button>
            <button className="share-btn-detail">
              <span><svg
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
  <path d="M64 40h128a16 16 0 0 1 16 16v160l-80-48-80 48V56a16 16 0 0 1 16-16z"/>
</svg>
</span> Lưu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeLibrary;
