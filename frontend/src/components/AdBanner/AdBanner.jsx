import { useContext } from 'react';
import { StoreContext } from '../../context/StoreContext';
import './AdBanner.css';

const AdBanner = () => {
  const { userData } = useContext(StoreContext);

  if (userData?.planType === 'premium') {
    return null;
  }

  const ads = [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=300&fit=crop',
      link: '#'
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=300&fit=crop',
      link: '#'
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=300&fit=crop',
      link: '#'
    }
  ];

  const randomAd = ads[Math.floor(Math.random() * ads.length)];

  return (
    <div className="ad-banner">
      <a href={randomAd.link} target="_blank" rel="noopener noreferrer">
        <img src={randomAd.image} alt="Advertisement" />
      </a>
    </div>
  );
};

export default AdBanner;
