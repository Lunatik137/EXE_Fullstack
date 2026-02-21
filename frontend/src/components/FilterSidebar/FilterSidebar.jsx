import PropTypes from 'prop-types';
import './FilterSidebar.css';

const FilterSidebar = ({ onFilterChange, currentFilter }) => {
  const filters = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Chia sẻ cảm nghĩ', value: 'normal' },
    { label: 'Công thức nấu ăn', value: 'recipe' },
    { label: 'Hỏi đáp dinh dưỡng', value: 'nutrition-qa' },
    { label: 'Review quán chay', value: 'review' }
  ];

  const handleFilterClick = (filterValue) => {
    if (onFilterChange) {
      onFilterChange(filterValue);
    }
  };

  return (
    <div className="filter-sidebar">
      <h3 className="filter-title">Bộ lọc</h3>
      <div className="filter-list">
        {filters.map((filter) => (
          <div
            key={filter.value}
            className={`filter-item ${currentFilter === filter.value ? 'active' : ''}`}
            onClick={() => handleFilterClick(filter.value)}
          >
            {filter.label}
          </div>
        ))}
      </div>
    </div>
  );
};

FilterSidebar.propTypes = {
  onFilterChange: PropTypes.func,
  currentFilter: PropTypes.string
};

export default FilterSidebar;
