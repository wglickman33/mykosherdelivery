import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { MenuStateContext } from "./menuContextShared";

// Provider component
export function MenuProvider({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isMobileMenuOpen &&
        !e.target.closest(".sidebar") &&
        !e.target.closest(".hamburger-button")
      ) {
        closeMobileMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu on window resize (if window becomes larger)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1110 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isMobileMenuOpen]);

  // Add/remove body class and prevent scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add("menu-open");
      document.body.style.overflow = "hidden";
    } else {
      document.body.classList.remove("menu-open");
      document.body.style.overflow = "";
    }

    return () => {
      document.body.classList.remove("menu-open");
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const menuContextValue = {
    isMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };

  return (
    <MenuStateContext.Provider value={menuContextValue}>
      {children}
    </MenuStateContext.Provider>
  );
}

MenuProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
