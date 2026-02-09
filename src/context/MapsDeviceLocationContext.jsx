import { createContext, useContext, useState } from 'react';

const MapsDeviceLocationContext = createContext(null);

export function MapsDeviceLocationProvider({ children }) {
  const [deviceLocation, setDeviceLocation] = useState(null);
  return (
    <MapsDeviceLocationContext.Provider value={{ deviceLocation, setDeviceLocation }}>
      {children}
    </MapsDeviceLocationContext.Provider>
  );
}

export function useMapsDeviceLocation() {
  const ctx = useContext(MapsDeviceLocationContext);
  if (!ctx) {
    return { deviceLocation: null, setDeviceLocation: () => {} };
  }
  return ctx;
}
