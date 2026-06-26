import { createContext, useContext, useState } from 'react';
import PropTypes from 'prop-types';

const MapsDeviceLocationContext = createContext(null);

export function MapsDeviceLocationProvider({ children }) {
  const [deviceLocation, setDeviceLocation] = useState(null);
  return (
    <MapsDeviceLocationContext.Provider value={{ deviceLocation, setDeviceLocation }}>
      {children}
    </MapsDeviceLocationContext.Provider>
  );
}

MapsDeviceLocationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useMapsDeviceLocation() {
  const ctx = useContext(MapsDeviceLocationContext);
  if (!ctx) {
    return { deviceLocation: null, setDeviceLocation: () => {} };
  }
  return ctx;
}
