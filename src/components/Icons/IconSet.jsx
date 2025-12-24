import PropTypes from 'prop-types';
import RestaurantIcon from "./RestaurantIcon";
import GroceryIcon from "./GroceryIcon";
import DeliveryIcon from "./DeliveryIcon";
import HomeIcon from "./HomeIcon";
import BlogIcon from "./BlogIcon";
import ContactIcon from "./ContactIcon";
import HelpIcon from "./HelpIcon";
import AccountIcon from "./AccountIcon";
import SearchIcon from "./SearchIcon";
import SettingsIcon from "./SettingsIcon";
import NotificationIcon from "./NotificationIcon";
import FavoritesIcon from "./FavoritesIcon";
import "./IconSet.scss";

const IconSet = ({ direction = "vertical" }) => {
  return (
    <div
      className={`icon-set ${direction === "horizontal" ? "horizontal" : ""}`}
    >
      <RestaurantIcon />
      <GroceryIcon />
      <DeliveryIcon />
      <HomeIcon />
      <BlogIcon />
      <ContactIcon />
      <HelpIcon />
      <AccountIcon />
      <SearchIcon />
      <SettingsIcon />
      <NotificationIcon />
      <FavoritesIcon />
    </div>
  );
};

IconSet.propTypes = {
  direction: PropTypes.oneOf(['vertical', 'horizontal'])
};

export default IconSet;

export const HeartIcon = ({ filled = false, ...props }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? "0" : "2"}
    />
  </svg>
);

HeartIcon.propTypes = {
  filled: PropTypes.bool
};
