import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import './RecipeLibrary.css';
import RecipeCategories from '../../components/RecipeCategories/RecipeCategories';
import RecipeDetailModal from '../../components/RecipeDetailModal/RecipeDetailModal';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import { getRecipeImageUrl } from '../../utils/recipeImage';

const RecipeLibrary = () => {
  const { url, token } = useContext(StoreContext);
  const { id: recipeId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('search') || '';
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTrulyPremium, setIsTrulyPremium] = useState(true); // optimistic default to avoid flash
  const [planChecked, setPlanChecked] = useState(false);
  const RECIPES_PER_PAGE = 12;
  const currentPage = useMemo(() => {
    if (selectedCategory !== 'all') return 1;
    const page = Number(searchParams.get('page'));
    if (!Number.isFinite(page) || page < 1) return 1;
    return Math.floor(page);
  }, [searchParams, selectedCategory]);

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
    'chien': 'chiên'
  };

  // Check if user has active premium subscription
  useEffect(() => {
    const checkPlan = async () => {
      if (!token) {
        setIsTrulyPremium(false);
        setPlanChecked(true);
        return;
      }
      try {
        const response = await axios.get(`${url}/api/user/current-plan`, {
          headers: { token }
        });
        if (response.data.success) {
          const { planType, remainingPremiumDays } = response.data;
          setIsTrulyPremium(planType === 'premium' && remainingPremiumDays > 0);
        } else {
          setIsTrulyPremium(false);
        }
      } catch {
        setIsTrulyPremium(false);
      } finally {
        setPlanChecked(true);
      }
    };
    checkPlan();
  }, [token, url]);

  const fetchRecipeById = useCallback(async (id) => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/recipes/${id}`);
      
      if (response.data.success) {
        setSelectedRecipe(response.data.recipe);
      }
    } catch (error) {
      console.error('Error fetching recipe:', error);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const fetchRecipes = useCallback(async () => {
    if (!planChecked) return;
    try {
      setLoading(true);
      let endpoint;

      // When searching, always fetch all recipes so client-side filter covers everything
      if (searchQuery || selectedCategory === 'all') {
        endpoint = `${url}/api/recipes/all?all=true`;
      } else {
        endpoint = `${url}/api/recipes/method/${selectedCategory}?all=true`;
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
  }, [selectedCategory, searchQuery, url, planChecked]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Fetch specific recipe if recipeId is in URL
  useEffect(() => {
    if (recipeId) {
      fetchRecipeById(recipeId);
    }
  }, [fetchRecipeById, recipeId]);

  const filteredRecipes = recipes
    .filter(recipe => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const inName = recipe.name?.toLowerCase().includes(q);
      const inDescription = recipe.description?.toLowerCase().includes(q);
      const inIngredients = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.some(ing => ing?.toLowerCase().includes(q))
        : false;
      return inName || inDescription || inIngredients;
    })
    .sort((a, b) => {
      if (!searchQuery && selectedCategory === 'all') {
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;
      }
      return 0;
    });

  const totalPages = Math.ceil(filteredRecipes.length / RECIPES_PER_PAGE);
  const safeCurrentPage = selectedCategory === 'all'
    ? Math.min(currentPage, Math.max(totalPages, 1))
    : 1;

  useEffect(() => {
    if (selectedCategory !== 'all') return;
    if (loading) return; // wait for recipes to load before clamping page
    if (safeCurrentPage === currentPage) return;

    const nextParams = new URLSearchParams(searchParams);
    if (safeCurrentPage <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(safeCurrentPage));
    }
    setSearchParams(nextParams, { replace: true });
  }, [currentPage, safeCurrentPage, searchParams, selectedCategory, setSearchParams]);

  const paginatedRecipes = selectedCategory === 'all'
    ? filteredRecipes.slice((safeCurrentPage - 1) * RECIPES_PER_PAGE, safeCurrentPage * RECIPES_PER_PAGE)
    : filteredRecipes;

  const updatePageInUrl = (pageNum) => {
    const nextParams = new URLSearchParams(searchParams);
    if (pageNum <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(pageNum));
    }
    setSearchParams(nextParams);
  };

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    navigate(`/recipes/${recipe._id}?${searchParams.toString()}`);
  };

  // Clear selected recipe when navigating back (recipeId removed from URL)
  useEffect(() => {
    if (!recipeId) {
      setSelectedRecipe(null);
    }
  }, [recipeId]);

  const mapRecipeForModal = (recipe) => {
    if (!recipe) return null;

    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ingredient) => {
          if (typeof ingredient === 'string') {
            return { amount: '', name: ingredient };
          }

          return {
            amount: ingredient?.amount || ingredient?.quantity || '',
            name: ingredient?.name || ingredient?.ingredient || '',
          };
        })
      : [];

    const totalTime =
      (Number(recipe.preparationTime) || 0) + (Number(recipe.cookingTime) || 0);

    const difficulty =
      recipe.difficulty ||
      (recipe.level === 'Dễ' ? 'easy' : recipe.level === 'Khó' ? 'hard' : 'medium');

    return {
      ...recipe,
      title: recipe.title || recipe.name,
      image: getRecipeImageUrl(recipe.image, url),
      ingredients,
      instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
      cookingTime: totalTime,
      difficulty,
      nutrition: {
        calories: Number(recipe.calories) || 0,
        protein: Number(recipe.protein) || 0,
        carbs: Number(recipe.carbs) || 0,
        fat: Number(recipe.fat) || 0,
        fiber: Number(recipe.fiber) || 0,
      },
    };
  };

  const handleCloseRecipeModal = () => {
    if (recipeId) {
      navigate(-1);
      return;
    }

    setSelectedRecipe(null);
  };

  return (
    <div className="recipe-library-page">
      {!selectedRecipe && (
        <div className="library-sidebar">
          <div className={`library-header${searchQuery ? ' search-mode' : ''}`}>
            {searchQuery ? (
              <>
                <h1 className="search-results-heading">{searchQuery} <span className="search-results-count">({filteredRecipes.length})</span></h1>
                <button
                  className="search-clear-btn"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete('search');
                    next.delete('page');
                    setSearchParams(next);
                  }}
                >
                  ← Xem tất cả công thức
                </button>
              </>
            ) : (
              <h1>Thư viện công thức</h1>
            )}
          </div>

          <RecipeCategories
            activeCategory={selectedCategory}
            onCategoryChange={(cat) => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete('page');

              if (cat === 'all') {
                nextParams.delete('category');
              } else {
                nextParams.set('category', cat);
              }

              setSearchParams(nextParams);
            }}
            hidden={!!searchQuery}
          />

          <div className="popular-section">
            {!searchQuery && <h2>Món {categoryNames[selectedCategory] || 'ăn'} hấp dẫn</h2>}
            {loading ? (
              <div className="loading">Đang tải công thức...</div>
            ) : (
              <div className="recipe-grid">
                {(searchQuery ? filteredRecipes : (selectedCategory === 'all' ? paginatedRecipes : filteredRecipes)).map(recipe => {
                  const isLocked = !isTrulyPremium && recipe.isFree === false;
                  return (
                    <div
                      key={recipe._id}
                      className={`recipe-card-item${isLocked ? ' locked-recipe' : ''}`}
                      onClick={() => {
                        if (!isLocked) handleRecipeClick(recipe);
                      }}
                      style={isLocked ? { pointerEvents: 'none', opacity: 0.5, filter: 'grayscale(0.5)' } : {}}
                    >
                      <div className="recipe-image">
                        <img src={getRecipeImageUrl(recipe.image, url) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop'} alt={recipe.name} />
                      </div>
                      <div className="recipe-content">
                        <h3>{recipe.name}</h3>
                        <div className="recipe-meta">
                          <span>⏱️ {(recipe.preparationTime || 0) + (recipe.cookingTime || 0)} phút</span>
                          <span>🔥 {recipe.calories} kcal</span>
                        </div>
                        {isLocked && (
                          <div className="locked-recipe-label">Chỉ dành cho Premium</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!searchQuery && selectedCategory === 'all' && totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                  <span
                    key={pageNum}
                    className={`page-num${safeCurrentPage === pageNum ? ' active' : ''}`}
                    onClick={() => updatePageInUrl(pageNum)}
                  >
                    {pageNum}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedRecipe && (
        <RecipeDetailModal
          recipe={mapRecipeForModal(selectedRecipe)}
          onClose={handleCloseRecipeModal}
        />
      )}
    </div>
  );
};

export default RecipeLibrary;
