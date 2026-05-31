import './RecipeCard.css';
import PropTypes from 'prop-types';

const RecipeCard = ({ recipe, onClick }) => {
  return (
    <div className="recipe-card" onClick={() => onClick(recipe)}>
      <div className="recipe-card-image">
        <img src={recipe.image} alt={recipe.title} />
        <div className="recipe-time-badge">
          <span>⏱️</span> {recipe.cookTime}
        </div>
      </div>
      <div className="recipe-card-content">
        <h3 className="recipe-card-title">{recipe.title}</h3>
        <div className="recipe-card-footer">
          <div className="recipe-rating">
            <span className="star">⭐</span>
            <span className="rating-value">{recipe.rating}</span>
            <span className="rating-count">({recipe.ratingCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

RecipeCard.propTypes = {
  recipe: PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    cookTime: PropTypes.string.isRequired,
    rating: PropTypes.number.isRequired,
    ratingCount: PropTypes.number.isRequired,
    category: PropTypes.string
  }).isRequired,
  onClick: PropTypes.func.isRequired
};

export default RecipeCard;
