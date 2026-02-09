import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { MapPin } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { MapsDeviceLocationProvider, useMapsDeviceLocation } from '../../context/MapsDeviceLocationContext';
import MapsThemeToggle from './MapsThemeToggle';
import whiteMKMLogo from '../../assets/whiteMKMLogo.png';
import './MapsLayout.scss';

function formatAddressShort(address) {
  if (!address) return 'Enter delivery address';
  if (typeof address === 'string') {
    return address.length > 35 ? address.substring(0, 35) + '…' : address;
  }
  if (typeof address === 'object' && address !== null) {
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.apartment) parts.push(address.apartment);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zip_code) parts.push(address.zip_code);
    if (parts.length > 0) {
      const full = parts.join(', ');
      return full.length > 35 ? full.substring(0, 35) + '…' : full;
    }
    if (address.address && typeof address.address === 'object') {
      const n = address.address;
      const nParts = [n.street, n.city, n.state].filter(Boolean);
      if (nParts.length > 0) {
        const full = nParts.join(', ');
        return full.length > 35 ? full.substring(0, 35) + '…' : full;
      }
    }
  }
  return 'Enter delivery address';
}

function formatAddressFull(address) {
  if (!address) return 'No delivery address selected';
  if (typeof address === 'string') return address;
  if (typeof address === 'object' && address !== null) {
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.apartment) parts.push(address.apartment);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zip_code) parts.push(address.zip_code);
    if (parts.length > 0) return parts.join(', ');
    if (address.address && typeof address.address === 'object') {
      const n = address.address;
      return [n.street, n.apartment, n.city, n.state, n.zip_code || n.zip].filter(Boolean).join(', ') || 'Address';
    }
  }
  return 'No delivery address selected';
}

function MapsLayoutInner({ children }) {
  const navigate = useNavigate();
  const { getCurrentAddress } = useAuth();
  const { deviceLocation } = useMapsDeviceLocation();
  const currentAddress = getCurrentAddress();
  const addressShort = formatAddressShort(currentAddress);
  const addressFull = formatAddressFull(currentAddress);
  const displayLabel = deviceLocation?.label
    ? (deviceLocation.label.length > 35 ? deviceLocation.label.substring(0, 35) + '…' : deviceLocation.label)
    : addressShort;
  const displayTitle = deviceLocation?.label ?? addressFull;

  return (
    <div className="maps-layout">
      <header className="maps-layout__header">
        <div className="maps-layout__header-inner">
          <Link to="/maps" className="maps-layout__logo" aria-label="My Kosher Maps home">
            <img src={whiteMKMLogo} alt="My Kosher Maps" className="maps-layout__logo-img" />
          </Link>
          <Link
            to="/account"
            className="maps-layout__address"
            title={displayTitle}
            aria-label={`Location: ${displayTitle}`}
          >
            <MapPin size={18} className="maps-layout__address-icon" aria-hidden />
            <span className="maps-layout__address-text">{displayLabel}</span>
          </Link>
          <nav className="maps-layout__nav">
            <MapsThemeToggle />
            <button type="button" className="maps-layout__btn maps-layout__btn--secondary" onClick={() => navigate('/home')}>
              Back to MKD
            </button>
            <Link to="/account" className="maps-layout__btn maps-layout__btn--account">Account</Link>
          </nav>
        </div>
      </header>
      <main className="maps-layout__main">
        {children}
      </main>
    </div>
  );
}

MapsLayoutInner.propTypes = {
  children: PropTypes.node,
};

const MapsLayout = ({ children }) => (
  <MapsDeviceLocationProvider>
    <MapsLayoutInner>{children}</MapsLayoutInner>
  </MapsDeviceLocationProvider>
);

MapsLayout.propTypes = {
  children: PropTypes.node,
};

export default MapsLayout;
