import './IconStyle.scss';

/**
 * Simple chevron-down for dropdowns. Uses currentColor for compliance and theme consistency.
 */
const ChevronDownIcon = ({ size = 24, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
    {...props}
  >
    <path d="M6 8L1 3h10z" fill="currentColor" />
  </svg>
);

export default ChevronDownIcon;
