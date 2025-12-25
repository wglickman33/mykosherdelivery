import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    
    scrollToTop();
    
    const timeoutId = setTimeout(scrollToTop, 10);

    const longTimeoutId = setTimeout(scrollToTop, 100);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(longTimeoutId);
    };
  }, [location.pathname, location.search, location.key]);
}; 