import PropTypes from 'prop-types';
import './FilterSidebar.css';

const FilterSidebar = ({ onFilterChange, currentFilter, token }) => {
  const filters = [
    { label: 'Tất cả', value: 'all' },
    ...(token
      ? [
          { label: 'Bài viết của tôi', value: 'my-posts' },
          { label: 'Người theo dõi', value: 'following-posts' },
        ]
      : []),
    { label: 'Chia sẻ cảm nghĩ', value: 'normal' },
    { label: 'Hỏi đáp dinh dưỡng', value: 'nutrition-qa' },
    { label: 'Review quán chay', value: 'review' },
    ...(token ? [{ label: 'Đã thích', value: 'liked-posts' }] : []),
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
  currentFilter: PropTypes.string,
  token: PropTypes.string
};

export default FilterSidebar;
