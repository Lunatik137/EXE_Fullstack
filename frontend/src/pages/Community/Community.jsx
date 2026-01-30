import { useState } from 'react';
import './Community.css';
import FilterSidebar from '../../components/FilterSidebar/FilterSidebar';
import CreatePost from '../../components/CreatePost/CreatePost';
import PostCard from '../../components/PostCard/PostCard';
import TrendingTopics from '../../components/TrendingTopics/TrendingTopics';
import RecipeDetailModal from '../../components/RecipeDetailModal/RecipeDetailModal';

const Community = () => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Sample posts data
  const posts = [
    {
      id: 1,
      author: 'Thảo Ly',
      avatar: 'https://ui-avatars.com/api/?name=Thao+Ly&background=e74c3c&color=fff',
      time: '2 giờ trước',
      content: 'Lần đầu làm phở chay mà chuẩn vị bất ngờ 😍 Nước dùng từ rau củ ngọt thanh không thua gì xương hầm luôn a!',
      image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop',
      hasRecipe: true,
      verified: false,
      likes: 342,
      comments: 58,
      recipe: {
        title: 'Phở chay nước dùng rau củ',
        image: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop',
        author: 'Thảo Ly',
        authorAvatar: 'https://ui-avatars.com/api/?name=Thao+Ly&background=e74c3c&color=fff',
        authorHandle: 'thao_ly_cook',
        location: 'Nha Trang',
        description: 'Đã cho lâu này mình mới thấy cá sống thốt tươi. Vậy là mua luôn 1 nồi canh cá. Ôi hương vị quá nhà đây rồi.',
        servings: '2 người',
        cookTime: '30 phút',
        seasonings: 'muối, bột ngọt, hành lá, ngò rí, tiêu',
        ingredients: [
          { amount: '5 con', name: 'cá sống thốt (≈600gr)' },
          { amount: '1/2 trái', name: 'thơm' },
          { amount: '4 trái', name: 'cà chua' }
        ],
        steps: [
          {
            text: 'Sơ chế cá, bóc mang, bỏ ruột, rửa sạch mấu cá. Để ráo nước',
            images: ['https://images.unsplash.com/photo-1511018556340-d16986a1c194?w=400&auto=format&fit=crop', 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=400&auto=format&fit=crop']
          },
          {
            text: 'Cà chua cắt múi cau, thơm cắt lát. Hành lá, ngò rí cắt nhỏ.',
            images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&auto=format&fit=crop', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&auto=format&fit=crop']
          },
          {
            text: 'Nấu nồi nước sôi, khi nước sôi, cho cá vào. Cho muối, bột ngọt vào, khi nước sôi lần tan thì cho cà chua, thơm vào.',
            images: ['https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&auto=format&fit=crop', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&auto=format&fit=crop', 'https://images.unsplash.com/photo-1604152135912-04a022e23696?w=400&auto=format&fit=crop']
          },
          {
            text: 'Khi canh sôi, nêm lại gia vị. Cho hành lá, ngò rí, xiu tiêu vào.',
            images: ['https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&auto=format&fit=crop']
          },
          {
            text: 'Tắt bếp. Ăn cơm thôi.',
            images: ['https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&auto=format&fit=crop']
          }
        ],
        comments: [
          {
            author: 'Khanh Tran',
            avatar: 'https://ui-avatars.com/api/?name=Khanh+Tran&background=9b59b6&color=fff',
            time: 'vào 28 tháng 1 năm 2025',
            text: 'Một bài mẹ thích từ nấu ăn đây! Mẹ và cả con đây rồi.'
          }
        ]
      }
    },
    {
      id: 2,
      author: 'Linh Vegan Chef',
      avatar: 'https://ui-avatars.com/api/?name=Linh+Chef&background=3498db&color=fff',
      time: '2 giờ trước',
      content: 'Protein thực vật: 7 nguồn dễ tìm ở VN vn. Đừng chỉ nghĩ đến đậu phụ, còn rất nhiều loại hạt rẻ tiền mà giàu dinh dưỡng...',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop',
      hasRecipe: true,
      verified: true,
      likes: 542,
      comments: 87,
      recipe: {
        title: 'Bowl Protein Thực Vật Đầy Màu Sắc',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop',
        author: 'Linh Vegan Chef',
        authorAvatar: 'https://ui-avatars.com/api/?name=Linh+Chef&background=3498db&color=fff',
        authorHandle: 'linh_vegan',
        location: 'Hà Nội',
        description: 'Một bữa ăn đầy đủ protein từ thực vật với màu sắc bắt mắt và dinh dưỡng cân đối.',
        servings: '2 người',
        cookTime: '25 phút',
        ingredients: [
          { amount: '100g', name: 'đậu gà' },
          { amount: '1 quả', name: 'bơ' },
          { amount: '100g', name: 'cà chua cherry' },
          { amount: '50g', name: 'rau xà lách' }
        ],
        steps: [
          { text: 'Luộc đậu gà với nước sôi trong 20 phút', images: [] },
          { text: 'Cắt bơ, cà chua, rửa rau sạch', images: [] },
          { text: 'Xếp tất cả vào bowl và thưởng thức', images: [] }
        ]
      }
    },
    {
      id: 3,
      author: 'Tuấn Kiệt',
      avatar: 'https://ui-avatars.com/api/?name=Tuan+Kiet&background=9b59b6&color=fff',
      time: '1 ngày trước',
      content: 'Review quán chay mới tìm được gần công ty. Đồ ăn ngon, giá cả hợp lý, không gian thoáng mát. Recommend cho ae đang ăn chay văn phòng! 👍',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
      hasRecipe: false,
      verified: false,
      likes: 128,
      comments: 23
    }
  ];

  const handleViewRecipe = (post) => {
    if (post.recipe) {
      setSelectedRecipe(post.recipe);
    }
  };

  return (
    <>
      <div className="community-page">
        <FilterSidebar />
        <div className="community-feed">
          <CreatePost />
          {posts.map(post => (
            <PostCard key={post.id} post={post} onViewRecipe={handleViewRecipe} />
          ))}
        </div>
        <TrendingTopics />
      </div>
      
      {selectedRecipe && (
        <RecipeDetailModal 
          recipe={selectedRecipe} 
          onClose={() => setSelectedRecipe(null)} 
        />
      )}
    </>
  );
};

export default Community;
