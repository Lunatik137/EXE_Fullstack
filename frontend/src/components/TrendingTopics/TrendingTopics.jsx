import './TrendingTopics.css';

const TrendingTopics = () => {
  const topics = [
    { hashtag: '#Anchay1thang', count: '2.1k' },
    { hashtag: '#SuaHatNhaLam', count: '2.1k' },
    { hashtag: '#ProteinThucVat', count: '2.1k' },
    { hashtag: '#ComChayVanPhong', count: '2.1k' }
  ];

  return (
    <div className="trending-topics">
      <h3 className="trending-title">Chủ đề nổi bật</h3>
      <div className="trending-list">
        {topics.map((topic, index) => (
          <div key={index} className="trending-item">
            <span className="trending-hashtag">{topic.hashtag}</span>
            <span className="trending-count">{topic.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendingTopics;
