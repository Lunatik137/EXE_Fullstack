import './MealSelectorModal.css';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

const normalizeVietnameseText = (value = '') =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const isWhiteRiceRecipeName = (name = '') =>
  normalizeVietnameseText(name).includes('com trang');

const MealSelectorModal = ({
  isOpen,
  mealType,
  availableRecipes,
  selectedRecipeIds,
  onSelect,
  onClose,
  maxSelections = 1,
  isLocked = false
}) => {
  const [selectedCount, setSelectedCount] = useState(selectedRecipeIds.length);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const recipeItems = availableRecipes.filter(recipe =>
    normalizeVietnameseText(recipe.name).includes(normalizeVietnameseText(searchQuery))
  );
  const riceRecipes = recipeItems.filter(recipe => isWhiteRiceRecipeName(recipe.name));
  const nonRiceRecipes = recipeItems.filter(recipe => !isWhiteRiceRecipeName(recipe.name));

  const selectedRiceCount = selectedRecipeIds.filter(id => {
    const recipe = availableRecipes.find(item => item._id === id);
    return recipe && isWhiteRiceRecipeName(recipe.name);
  }).length;

  const selectedNonRiceCount = selectedRecipeIds.filter(id => {
    const recipe = availableRecipes.find(item => item._id === id);
    return recipe && !isWhiteRiceRecipeName(recipe.name);
  }).length;

  const handleRecipeToggle = (recipeId, isRice) => {
    if (isLocked) return;

    const isSelected = selectedRecipeIds.includes(recipeId);

    if (isSelected) {
      onSelect(recipeId, false, isRice);
      setSelectedCount(selectedCount - 1);
    } else {
      onSelect(recipeId, true, isRice);
      setSelectedCount(selectedCount + 1);
    }
  };

  const mealLabels = { breakfast: 'BỮA SÁNG', lunch: 'BỮA TRƯA', dinner: 'BỮA TỐI' };

  const renderRecipeItem = recipe => {
    const isSelected = selectedRecipeIds.includes(recipe._id);
    const isRice = isWhiteRiceRecipeName(recipe.name);

    let isDisabled = false;
    if (!isSelected) {
      if (isLocked) {
        isDisabled = true;
      } else if (mealType === 'breakfast') {
        isDisabled = selectedCount >= maxSelections;
      } else {
        isDisabled = isRice ? selectedRiceCount >= 1 : selectedNonRiceCount >= 5;
      }
    }

    return (
      <div
        key={recipe._id}
        className={`recipe-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
        onClick={() => !isDisabled && handleRecipeToggle(recipe._id, isRice)}
      >
        <div className="recipe-checkbox">
          {isSelected && <span className="checkmark">✓</span>}
        </div>

        <div className="recipe-info">
          <div className="recipe-name-row">
            <h4 className="recipe-name">{recipe.name}</h4>
            {isRice && <span className="rice-tag">Cơm trắng</span>}
          </div>
          <div className="recipe-nutrients">
            <span>{recipe.calories} kcal</span>
            <span>{recipe.protein}g Protein</span>
            <span>{recipe.carbs}g Carbs</span>
            <span>{recipe.fat}g Chất béo</span>
            <span>{recipe.fiber ?? 0}g Chất xơ</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="meal-selector-overlay" onClick={onClose}>
      <div className="meal-selector-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mealLabels[mealType] || mealType}</h3>
          <p className="selection-info">
            {mealType === 'breakfast' 
              ? 'Chọn 1 món'
              : `Chọn tối đa 5 món + 1 cơm: ${selectedCount} món được chọn`}
          </p>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-search">
          <input
            type="text"
            className="modal-search-input"
            placeholder="Tìm kiếm món ăn..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="modal-recipes-list">
          {recipeItems.length === 0 ? (
            <div className="no-recipes">Không có món ăn nào</div>
          ) : mealType === 'breakfast' ? (
            recipeItems.map(renderRecipeItem)
          ) : (
            <div className="recipes-two-column">
              <div className="recipe-column">
                <div className="column-title">Chọn cơm (tối đa 1)</div>
                <div className="column-list">
                  {riceRecipes.length > 0 ? (
                    riceRecipes.map(renderRecipeItem)
                  ) : (
                    <div className="column-empty">Không có món cơm</div>
                  )}
                </div>
              </div>

              <div className="recipe-column">
                <div className="column-title">Chọn món ăn (tối đa 5)</div>
                <div className="column-list">
                  {nonRiceRecipes.length > 0 ? (
                    nonRiceRecipes.map(renderRecipeItem)
                  ) : (
                    <div className="column-empty">Không có món ăn</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn-confirm"
            onClick={onClose}
            disabled={selectedCount === 0}
          >
            Xác nhận ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
};

MealSelectorModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mealType: PropTypes.string.isRequired,
  availableRecipes: PropTypes.array.isRequired,
  selectedRecipeIds: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  maxSelections: PropTypes.number,
  isLocked: PropTypes.bool
};

export default MealSelectorModal;
