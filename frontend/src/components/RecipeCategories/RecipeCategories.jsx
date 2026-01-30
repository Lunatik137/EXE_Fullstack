import { useState } from 'react';
import './RecipeCategories.css';

const RecipeCategories = ({ onCategoryChange }) => {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'xao', name: 'Xào', icon: '🥘' },
    { id: 'luoc', name: 'Luộc', icon: '🍲' },
    { id: 'nuong', name: 'Nướng', icon: '🔥' },
    { id: 'kho', name: 'Kho', icon: '🍯' },
    { id: 'canh', name: 'Canh', icon: '🥣' },
    { id: 'tron', name: 'Trộn', icon: '🥗' },
    { id: 'hap', name: 'Hấp', icon: '♨️' },
    { id: 'chien', name: 'Chiên giòn', icon: '🍳' }
  ];

  const handleCategoryClick = (categoryId) => {
    setActiveCategory(categoryId);
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
  };

  return (
    <div className="recipe-categories">
      {categories.map((category) => (
        <button
          key={category.id}
          className={`category-btn ${activeCategory === category.id ? 'active' : ''}`}
          onClick={() => handleCategoryClick(category.id)}
        >
          <span className="category-icon">{category.icon}</span>
          <span className="category-name">{category.name}</span>
        </button>
      ))}
    </div>
  );
};

export default RecipeCategories;
