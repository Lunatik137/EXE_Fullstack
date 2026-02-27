import { useContext, useState, useEffect } from 'react';
import { StoreContext } from '../../context/StoreContext';
import './AdPopup.css';

const AdPopup = () => {
  const { userData } = useContext(StoreContext);
  const [showAd, setShowAd] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [canClose, setCanClose] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile || userData?.planType === 'premium') {
      setShowAd(false);
      return;
    }
    setShowAd(true);
    setCountdown(15);
    setCanClose(false);
  }, [userData, isMobile]);

  useEffect(() => {
    if (!showAd) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showAd]);

  if (!showAd) return null;

  const ad = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop';

  return (
    <div className="ad-popup-overlay">
      <div className="ad-popup">
        {!canClose ? (
          <div className="ad-countdown">{countdown}s</div>
        ) : (
          <button className="ad-close" onClick={() => setShowAd(false)}>✕</button>
        )}
        <img src={ad} alt="Advertisement" />
      </div>
    </div>
  );
};

export default AdPopup;
