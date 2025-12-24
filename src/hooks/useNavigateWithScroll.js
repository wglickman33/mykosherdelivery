import { useNavigate } from 'react-router-dom';

export const useNavigateWithScroll = () => {
  const navigate = useNavigate();

  const navigateWithScroll = (to, options = {}) => {
    const scrollToTop = () => {
      // Multiple scroll methods for maximum compatibility
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    
    // Scroll to top immediately
    scrollToTop();
    
    // Navigate
    navigate(to, options);
    
    // Backup scroll after navigation
    setTimeout(scrollToTop, 10);
    
    // Additional backup for slower content
    setTimeout(scrollToTop, 100);
  };

  return navigateWithScroll;
}; 