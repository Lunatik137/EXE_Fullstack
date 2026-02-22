import "./RecipeDetailModal.css";
import PropTypes from "prop-types";

const RecipeDetailModal = ({ recipe, onClose }) => {
  if (!recipe) return null;

  return (
    <div className="recipe-modal-overlay" onClick={onClose}>
      <div className="recipe-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          ×
        </button>

        <div className="recipe-modal-content">
          {/* Left side - Image and ingredients */}
          <div className="recipe-left">
            <img
              src={recipe.image}
              alt={recipe.title}
              className="recipe-main-image"
            />

            <div className="recipe-info-box">
              <h3>Nguyên Liệu</h3>
              <div className="ingredients-list">
                {recipe.ingredients?.map((ingredient, index) => (
                  <div key={index} className="ingredient-item">
                    <span className="ingredient-amount">
                      {ingredient.amount}
                    </span>
                    <span className="ingredient-name">{ingredient.name}</span>
                  </div>
                ))}
              </div>
              <p className="ingredients-note">
                Giá vị:{" "}
                {recipe.seasonings || "muối, bột ngọt, hành lá, ngò rí, tiêu"}
              </p>
            </div>
          </div>

          {/* Right side - Instructions and comments */}
          <div className="recipe-right">
            <div className="recipe-header">
              <h1 className="recipe-title">{recipe.title}</h1>
              <div className="recipe-author">
                <img src={recipe.authorAvatar} alt={recipe.author} />
                <div>
                  <p className="author-name">
                    {recipe.author}{" "}
                    <span className="author-handle">
                      @{recipe.authorHandle}
                    </span>
                  </p>
                  <p className="author-location">
                    📍 {recipe.location || "Nha Trang"}
                  </p>
                </div>
              </div>
            </div>

            <div className="recipe-steps">
              <h3>Hướng dẫn cách làm</h3>

              <div className="recipe-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <p className="step-text">Ngâm bánh phở trong nước ấm khoảng 10-15 phút cho mềm. Nấm hương ngâm nở, rửa sạch và thái lát.</p>
                </div>
              </div>

              <div className="recipe-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <p className="step-text">Cho nước vào nồi, thêm nấm hương, hành tây, gừng. Nêm gia vị (muối, bột ngọt, nước tương) để tạo nước dùng có vị ngọt thanh.</p>
                </div>
              </div>

              <div className="recipe-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <p className="step-text">Cho bánh phở đã ngâm vào tô, chan nước dùng nóng lên trên. Thêm rau thơm (hành lá, ngò rí), tiêu và chanh.</p>
                </div>
              </div>
            </div>

            <div className="recipe-actions">
              <button className="action-btn save-btn">
                <span>
                  <svg
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
                    <path d="M64 40h128a16 16 0 0 1 16 16v160l-80-48-80 48V56a16 16 0 0 1 16-16z" />
                  </svg>
                </span>{" "}
                Lưu Món
              </button>
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
    image: PropTypes.string.isRequired,
    author: PropTypes.string.isRequired,
    authorAvatar: PropTypes.string.isRequired,
    authorHandle: PropTypes.string,
    location: PropTypes.string,
    description: PropTypes.string,
    servings: PropTypes.string,
    cookTime: PropTypes.string,
    seasonings: PropTypes.string,
    ingredients: PropTypes.arrayOf(
      PropTypes.shape({
        amount: PropTypes.string,
        name: PropTypes.string,
      }),
    ),
    steps: PropTypes.arrayOf(
      PropTypes.shape({
        text: PropTypes.string,
        images: PropTypes.arrayOf(PropTypes.string),
      }),
    ),
    comments: PropTypes.arrayOf(
      PropTypes.shape({
        author: PropTypes.string,
        avatar: PropTypes.string,
        time: PropTypes.string,
        text: PropTypes.string,
      }),
    ),
  }),
  onClose: PropTypes.func.isRequired,
};

export default RecipeDetailModal;
