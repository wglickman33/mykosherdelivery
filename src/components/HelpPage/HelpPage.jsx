import { useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../Footer/Footer';
import './HelpPage.scss';

const HelpPage = () => {
  const [activeVideo, setActiveVideo] = useState(null);

  const tutorialSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'Learn the basics of using MKD for food delivery',
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="help-page__section-icon-svg">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      ),
      videos: [
        {
          id: 'welcome-tour',
          title: 'Welcome Tour',
          description: 'Take a quick tour of the MKD platform',
          duration: '3:45',
          videoUrl: '/videos/welcome-tour.mp4',
          thumbnail: '/thumbnails/welcome-tour.jpg'
        },
        {
          id: 'first-order',
          title: 'Placing Your First Order',
          description: 'Step-by-step guide to ordering food',
          duration: '5:20',
          videoUrl: '/videos/first-order.mp4',
          thumbnail: '/thumbnails/first-order.jpg'
        }
      ]
    },
    {
      id: 'ordering',
      title: 'Ordering & Delivery',
      description: 'Master the ordering process and track your deliveries',
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="help-page__section-icon-svg">
          <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
        </svg>
      ),
      videos: [
        {
          id: 'browse-restaurants',
          title: 'Browsing Restaurants',
          description: 'Find and explore restaurants in your area',
          duration: '4:15',
          videoUrl: '/videos/browse-restaurants.mp4',
          thumbnail: '/thumbnails/browse-restaurants.jpg'
        },
        {
          id: 'menu-navigation',
          title: 'Navigating Menus',
          description: 'Browse menus, customize orders, and add items to cart',
          duration: '6:30',
          videoUrl: '/videos/menu-navigation.mp4',
          thumbnail: '/thumbnails/menu-navigation.jpg'
        },
        {
          id: 'checkout-process',
          title: 'Checkout & Payment',
          description: 'Complete your order with payment and delivery details',
          duration: '7:45',
          videoUrl: '/videos/checkout-process.mp4',
          thumbnail: '/thumbnails/checkout-process.jpg'
        },
        {
          id: 'track-delivery',
          title: 'Track Your Delivery',
          description: 'Monitor your order status and delivery progress',
          duration: '3:20',
          videoUrl: '/videos/track-delivery.mp4',
          thumbnail: '/thumbnails/track-delivery.jpg'
        }
      ]
    },
    {
      id: 'account-management',
      title: 'Account & Settings',
      description: 'Manage your profile, addresses, and preferences',
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="help-page__section-icon-svg">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      ),
      videos: [
        {
          id: 'profile-setup',
          title: 'Profile Setup',
          description: 'Create and customize your MKD profile',
          duration: '4:50',
          videoUrl: '/videos/profile-setup.mp4',
          thumbnail: '/thumbnails/profile-setup.jpg'
        },
        {
          id: 'address-management',
          title: 'Manage Addresses',
          description: 'Add, edit, and organize your delivery addresses',
          duration: '5:15',
          videoUrl: '/videos/address-management.mp4',
          thumbnail: '/thumbnails/address-management.jpg'
        },
        {
          id: 'favorites-settings',
          title: 'Favorites & Preferences',
          description: 'Save favorite restaurants and customize your experience',
          duration: '4:30',
          videoUrl: '/videos/favorites-settings.mp4',
          thumbnail: '/thumbnails/favorites-settings.jpg'
        }
      ]
    },
    {
      id: 'mobile-app',
      title: 'Mobile Experience',
      description: 'Get the most out of MKD on your mobile device',
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="help-page__section-icon-svg">
          <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
        </svg>
      ),
      videos: [
        {
          id: 'mobile-navigation',
          title: 'Mobile Navigation',
          description: 'Navigate MKD efficiently on your smartphone',
          duration: '4:00',
          videoUrl: '/videos/mobile-navigation.mp4',
          thumbnail: '/thumbnails/mobile-navigation.jpg'
        },
        {
          id: 'mobile-ordering',
          title: 'Mobile Ordering Tips',
          description: 'Optimize your ordering experience on mobile',
          duration: '5:45',
          videoUrl: '/videos/mobile-ordering.mp4',
          thumbnail: '/thumbnails/mobile-ordering.jpg'
        }
      ]
    }
  ];

  const handleVideoClick = (video) => {
    setActiveVideo(video);
  };

  const closeVideo = () => {
    setActiveVideo(null);
  };

  return (
    <div className="help-page">
      <div className="help-page__container">
        <div className="help-page__content">
          {}
          <div className="help-page__header">
            <h1 className="help-page__header-title">How to Use MKD</h1>
            <p className="help-page__header-description">Step-by-step video tutorials to help you get the most out of our kosher food delivery platform</p>
            <div className="help-page__header-actions">
              <Link to="/faq" className="help-page__faq-link">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="help-page__faq-link-icon">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                </svg>
                View FAQs
              </Link>
            </div>
          </div>

          {}
          <div className="help-page__tutorial-sections">
            {tutorialSections.map((section) => (
              <div key={section.id} className="help-page__tutorial-section">
                <div className="help-page__section-header">
                  <div className="help-page__section-icon">
                    {section.icon}
                  </div>
                  <div className="help-page__section-info">
                    <h2 className="help-page__section-title">{section.title}</h2>
                    <p className="help-page__section-description">{section.description}</p>
                  </div>
                </div>
                
                <div className="help-page__video-grid">
                  {section.videos.map((video) => (
                    <div key={video.id} className="help-page__video-card" onClick={() => handleVideoClick(video)}>
                      <div className="help-page__video-thumbnail">
                        <img src={video.thumbnail} alt={video.title} className="help-page__video-thumbnail-image" />
                        <div className="help-page__video-play-button">
                          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" className="help-page__video-play-button-icon">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                        <div className="help-page__video-duration">{video.duration}</div>
                      </div>
                      <div className="help-page__video-info">
                        <h3 className="help-page__video-title">{video.title}</h3>
                        <p className="help-page__video-description">{video.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {}
          <div className="help-page__resources">
            <h2 className="help-page__resources-title">Need More Help?</h2>
            <div className="help-page__resource-cards">
              <Link to="/faq" className="help-page__resource-card">
                <div className="help-page__resource-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="help-page__resource-icon-svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                  </svg>
                </div>
                <h3 className="help-page__resource-title">Frequently Asked Questions</h3>
                <p className="help-page__resource-description">Find answers to common questions about MKD</p>
              </Link>
              
              <Link to="/contact" className="help-page__resource-card">
                <div className="help-page__resource-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="help-page__resource-icon-svg">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </div>
                <h3 className="help-page__resource-title">Contact Support</h3>
                <p className="help-page__resource-description">Get in touch with our customer support team</p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {}
      {activeVideo && (
        <div className="help-page__video-modal-overlay" onClick={closeVideo}>
          <div className="help-page__video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-page__video-modal-header">
              <h3 className="help-page__video-modal-title">{activeVideo.title}</h3>
              <button className="help-page__video-modal-close" onClick={closeVideo}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="help-page__video-modal-close-icon">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="help-page__video-player">
              <video controls className="help-page__video-player-element">
                <source src={activeVideo.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="help-page__video-modal-description">
              <p className="help-page__video-modal-description-text">{activeVideo.description}</p>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default HelpPage; 