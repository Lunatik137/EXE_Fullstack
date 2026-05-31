import "./RecipeDetailModal.css";
import PropTypes from "prop-types";

const difficultyLabel = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };
const categoryLabel = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  snack: "Bữa phụ",
  dessert: "Tráng miệng",
};
const recipeFallbackImage =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&auto=format&fit=crop&q=80";

const RecipeDetailModal = ({ recipe, onClose }) => {
  if (!recipe) return null;

  return (
    <div className="recipe-modal-overlay" onClick={onClose}>
      <div className="recipe-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          ×
        </button>

        <div className="recipe-modal-content">
          {/* Left column: image + side-card */}
          <div className="recipe-left">
            <img
              src={recipe.image || recipeFallbackImage}
              alt={recipe.title}
              className="recipe-main-image"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = recipeFallbackImage;
              }}
            />

            <div className="recipe-side-card">
              <div className="recipe-info-box">
                <h3>Nguyên Liệu</h3>
                <div className="ingredients-list">
                  {recipe.ingredients?.length > 0 ? (
                    recipe.ingredients.map((ingredient, index) => (
                      <div key={index} className="ingredient-item">
                        <span className="ingredient-amount">
                          {ingredient.amount}
                        </span>
                        <span className="ingredient-name">{ingredient.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="ingredients-note">
                      Chưa có thông tin nguyên liệu.
                    </p>
                  )}
                </div>
              </div>

              {recipe.nutrition &&
                Object.values(recipe.nutrition).some(Boolean) && (
                  <div className="recipe-nutrition">
                    <h3>Dinh dưỡng</h3>
                    <div className="recipe-meta">
                      {recipe.nutrition.calories > 0 && (
                        <span>🔥 {recipe.nutrition.calories} kcal</span>
                      )}
                      {recipe.nutrition.protein > 0 && (
                        <span>💪 Protein: {recipe.nutrition.protein}g</span>
                      )}
                      {recipe.nutrition.carbs > 0 && (
                        <span>🌾 Carbs: {recipe.nutrition.carbs}g</span>
                      )}
                      {recipe.nutrition.fat > 0 && (
                        <span>🥑 Chất béo: {recipe.nutrition.fat}g</span>
                      )}
                      {recipe.nutrition.fiber > 0 && (
                        <span>🌿 Chất xơ: {recipe.nutrition.fiber}g</span>
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Right column: header + steps */}
          <div className="recipe-right">
            <div className="recipe-header">
              <h1 className="recipe-title">{recipe.title}</h1>
              {recipe.author && (
                <div className="recipe-author">
                  {recipe.authorAvatar && (
                    <img src={recipe.authorAvatar} alt={recipe.author} />
                  )}
                  <div>
                    <p className="author-name">{recipe.author}</p>
                  </div>
                </div>
              )}
              <div className="recipe-meta">
                {recipe.cookingTime > 0 && (
                  <span>⏱ {recipe.cookingTime} phút</span>
                )}
                {recipe.difficulty && (
                  <span>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="10" width="4" height="10" rx="1" />
                      <rect x="10" y="6" width="4" height="14" rx="1" />
                      <rect x="17" y="13" width="4" height="7" rx="1" />
                    </svg>{" "}
                    {difficultyLabel[recipe.difficulty] || recipe.difficulty}
                  </span>
                )}
              </div>
            </div>

            <div className="recipe-steps">
              <h3>Hướng dẫn cách làm</h3>
              {recipe.instructions?.length > 0 ? (
                recipe.instructions.map((step, index) => (
                  <div key={index} className="recipe-step">
                    <div className="step-number">{index + 1}</div>
                    <div className="step-content">
                      <p className="step-text">{step}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="step-text">Chưa có hướng dẫn cách làm.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

RecipeDetailModal.propTypes = {
  recipe: PropTypes.shape({
    title: PropTypes.string.isRequired,
    image: PropTypes.string,
    author: PropTypes.string,
    authorAvatar: PropTypes.string,
    cookingTime: PropTypes.number,
    difficulty: PropTypes.string,
    category: PropTypes.string,
    ingredients: PropTypes.arrayOf(
      PropTypes.shape({
        amount: PropTypes.string,
        name: PropTypes.string,
      }),
    ),
    instructions: PropTypes.arrayOf(PropTypes.string),
    nutrition: PropTypes.shape({
      calories: PropTypes.number,
      protein: PropTypes.number,
      carbs: PropTypes.number,
      fat: PropTypes.number,
      fiber: PropTypes.number,
    }),
  }),
  onClose: PropTypes.func.isRequired,
};

export default RecipeDetailModal;
