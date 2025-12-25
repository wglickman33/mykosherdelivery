import { useNavigate } from 'react-router-dom';

export const useNavigateWithScroll = () => {
  const navigate = useNavigate();

  const navigateWithScroll = (to, options = {}) => {
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    
    scrollToTop();
    
    navigate(to, options);
    
    setTimeout(scrollToTop, 10);
    
    setTimeout(scrollToTop, 100);
  };

  return navigateWithScroll;
}; 