import { useState } from 'react';
import './RecipeCategories.css';

const RecipeCategories = ({ onCategoryChange }) => {
  const [activeCategory, setActiveCategory] = useState('all');

  const categoryIcons = {
    xao: (
      <svg
  width="256"
  height="256"
  viewBox="0 0 256 256"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  stroke="currentColor"
  strokeWidth="10"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <path d="M40 140c10 40 166 40 176 0" />

  <path d="M40 140c20-30 156-30 176 0" />

  <path d="M216 118h30c6 0 10 4 10 10s-4 10-10 10h-30" />

  <path d="M90 110c10-10 20-10 30 0" />
  <path d="M130 105c12-12 24-12 36 0" />
  <path d="M110 95c6-8 14-8 20 0" />

  <path d="M90 60c-10 10-10 20 0 30" />
  <path d="M130 50c-10 12-10 24 0 36" />
  <path d="M170 60c-10 10-10 20 0 30" />
</svg>

    ),
    luoc: (
      <svg width="256" height="256" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
  <path d="M48 150h160" />
  <path d="M64 150v-40h128v40" />
  <path d="M96 70c-10 10-10 20 0 30" />
  <path d="M128 60c-10 12-10 24 0 36" />
  <path d="M160 70c-10 10-10 20 0 30" />
</svg>

    ),
    nuong: (
      <svg width="256" height="256" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
  <path d="M40 150h176" />
  <path d="M60 130h136" />
  <path d="M80 110h96" />
  <path d="M88 150v30" />
  <path d="M168 150v30" />
</svg>

    ),
    kho: (
      <svg width="256" height="256" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
  <path d="M48 160c0-30 160-30 160 0" />
  <path d="M48 160v20h160v-20" />
  <path d="M96 120c12-8 24-8 36 0" />
  <path d="M140 118c10-6 20-6 30 0" />
</svg>

    ),
    canh: (
      <svg width="256" height="256" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
  <path d="M40 150c10 40 166 40 176 0" />
  <path d="M40 150c20-30 156-30 176 0" />
  <path d="M100 120c6-6 14-6 20 0" />
  <path d="M140 115c6-6 14-6 20 0" />
</svg>

    ),
    tron: (
      <svg width="256" height="256" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
  <path d="M48 160c0-30 160-30 160 0" />
  <path d="M48 160v20h160v-20" />
  <path d="M128 80v70" />
  <path d="M112 96l16-16 16 16" />
</svg>

    ),
    hap: (
      <svg width="256" height="256" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
  <path d="M48 160h160" />
  <path d="M64 160v-20h128v20" />
  <path d="M96 90c-10 10-10 20 0 30" />
  <path d="M128 80c-10 12-10 24 0 36" />
  <path d="M160 90c-10 10-10 20 0 30" />
</svg>

    ),
    chien: (
      <svg width="256" height="256" viewBox="0 0 256 256" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
  <path d="M40 150c10 40 166 40 176 0" />
  <path d="M40 150c20-30 156-30 176 0" />
  <path d="M96 110l8 8-8 8-8-8z" />
  <path d="M128 105l10 10-10 10-10-10z" />
  <path d="M160 110l8 8-8 8-8-8z" />
</svg>

    )
  };

  const categories = [
    { id: 'xao', name: 'Xào' },
    { id: 'luoc', name: 'Luộc' },
    { id: 'nuong', name: 'Nướng' },
    { id: 'kho', name: 'Kho' },
    { id: 'canh', name: 'Canh' },
    { id: 'tron', name: 'Trộn' },
    { id: 'hap', name: 'Hấp' },
    { id: 'chien', name: 'Chiên giòn' }
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
          <span className="category-icon">{categoryIcons[category.id]}</span>
          <span className="category-name">{category.name}</span>
        </button>
      ))}
    </div>
  );
};

export default RecipeCategories;
