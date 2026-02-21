import { useState, useEffect, useContext, useCallback } from 'react';
import PropTypes from 'prop-types';
import './TrendingTopics.css';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';

const TrendingTopics = ({ onHashtagClick, selectedHashtag }) => {
  const { url } = useContext(StoreContext);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTrendingHashtags = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/posts/trending-hashtags?limit=10`);
      
      if (response.data.success) {
        setTopics(response.data.hashtags);
      }
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchTrendingHashtags();
  }, [fetchTrendingHashtags]);

  const formatCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div className="trending-topics">
      <h3 className="trending-title">Chủ đề nổi bật</h3>
      <div className="trending-list">
        {loading ? (
          <div className="trending-loading">Đang tải...</div>
        ) : topics.length === 0 ? (
          <div className="trending-empty">Chưa có chủ đề nào</div>
        ) : (
          topics.map((topic, index) => (
            <div 
              key={index} 
              className={`trending-item ${selectedHashtag === topic.hashtag ? 'active' : ''}`}
              onClick={() => onHashtagClick && onHashtagClick(topic.hashtag)}
              style={{ cursor: 'pointer' }}
            >
              <span className="trending-hashtag">#{topic.hashtag}</span>
              <span className="trending-count">{formatCount(topic.count)} bài viết</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

TrendingTopics.propTypes = {
  onHashtagClick: PropTypes.func,
  selectedHashtag: PropTypes.string
};

export default TrendingTopics;
