import { createContext, useContext } from 'react';

export const NursingHomeFacilityContext = createContext({ facility: null, facilityLoading: true });

export const useNursingHomeFacility = () => useContext(NursingHomeFacilityContext);
