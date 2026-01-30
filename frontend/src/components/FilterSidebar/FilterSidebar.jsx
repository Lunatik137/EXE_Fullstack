import { useState } from 'react';
import './FilterSidebar.css';

const FilterSidebar = () => {
  const [activeFilter, setActiveFilter] = useState('Mới nhất');

  const filters = [
    'Mới nhất',
    'Công thức nấu ăn',
    'Hỏi đáp dinh dưỡng',
    'Góc chuyện già',
    'Review quán chay'
  ];

  return (
    <div className="filter-sidebar">
      <h3 className="filter-title">Bộ lọc</h3>
      <div className="filter-list">
        {filters.map((filter) => (
          <div
            key={filter}
            className={`filter-item ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterSidebar;
