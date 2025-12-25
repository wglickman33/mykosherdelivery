import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./IconSidebar.scss";
import { useMenu } from "../../context/menuContextShared.jsx";
import { useAuth } from "../../hooks/useAuth";

const IconSidebar = () => {
  const { closeMobileMenu } = useMenu();
  const { user } = useAuth();
  const location = useLocation();
  const [activeItem, setActiveItem] = useState("/home");

  useEffect(() => {
    const path = location.pathname;
    setActiveItem(path);
  }, [location]);

  const isActive = (path) => {
    if (path === "/home" && (activeItem === "/home" || activeItem === "/")) {
      return true;
    }
    return path !== "/home" && activeItem.startsWith(path);
  };

  const handleLinkClick = () => {
    if (window.innerWidth <= 1110) {
      closeMobileMenu();
    }
  };

  return (
    <div className="icon-sidebar">
      <nav className="icon-sidebar-nav">
        <ul className="icon-sidebar-menu">
          <li
            className={`icon-sidebar-menu-item ${
              isActive("/home") ? "active" : ""
            }`}
          >
            <Link
              to="/home"
              className="icon-sidebar-menu-link"
              onClick={handleLinkClick}
            >
              <div className="icon-sidebar-icon">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#061757"
                    d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"
                  />
                </svg>
              </div>
            </Link>
          </li>
          <li
            className={`icon-sidebar-menu-item ${
              isActive("/restaurants") ? "active" : ""
            }`}
          >
            <Link
              to="/restaurants"
              className="icon-sidebar-menu-link"
              onClick={handleLinkClick}
            >
              <div className="icon-sidebar-icon">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#061757"
                    d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"
                  />
                </svg>
              </div>
            </Link>
          </li>
          <li
            className={`icon-sidebar-menu-item ${
              isActive("/blog") ? "active" : ""
            }`}
          >
            <Link
              to="/blog"
              className="icon-sidebar-menu-link"
              onClick={handleLinkClick}
            >
              <div className="icon-sidebar-icon">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#061757"
                    d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
                  />
                </svg>
              </div>
            </Link>
          </li>
          <li
            className={`icon-sidebar-menu-item ${
              isActive("/contact") ? "active" : ""
            }`}
          >
            <Link
              to="/contact"
              className="icon-sidebar-menu-link"
              onClick={handleLinkClick}
            >
              <div className="icon-sidebar-icon">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#061757"
                    d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
                  />
                </svg>
              </div>
            </Link>
          </li>
          <li
            className={`icon-sidebar-menu-item ${
              isActive("/help") ? "active" : ""
            }`}
          >
            <Link
              to="/help"
              className="icon-sidebar-menu-link"
              onClick={handleLinkClick}
            >
              <div className="icon-sidebar-icon">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#061757"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
                  />
                </svg>
              </div>
            </Link>
          </li>
          {user && (
            <li
              className={`icon-sidebar-menu-item ${
                isActive("/account") ? "active" : ""
              }`}
            >
              <Link
                to="/account"
                className="icon-sidebar-menu-link"
                onClick={handleLinkClick}
              >
                <div className="icon-sidebar-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path
                      fill="#061757"
                      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z"
                    />
                  </svg>
                </div>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      <div className="icon-sidebar-footer">
        <Link
          to="/signin"
          className={`icon-sidebar-login-link ${
            isActive("/signin") ? "active" : ""
          }`}
          onClick={handleLinkClick}
        >
          <div className="icon-sidebar-icon">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="#061757"
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default IconSidebar;
