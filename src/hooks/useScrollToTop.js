import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    // Multiple strategies to ensure scroll to top works reliably across all browsers
    
    const scrollToTop = () => {
      // Multiple scroll methods for maximum compatibility
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    
    // Immediate scroll
    scrollToTop();
    
    // Backup scroll after a short delay to handle async content
    const timeoutId = setTimeout(scrollToTop, 10);

    // Additional backup for slower content loading
    const longTimeoutId = setTimeout(scrollToTop, 100);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(longTimeoutId);
    };
  }, [location.pathname, location.search, location.key]);
}; 