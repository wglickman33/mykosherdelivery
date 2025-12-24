import { createContext, useContext } from 'react';

export const MenuStateContext = createContext();

export function useMenu() {
  return useContext(MenuStateContext);
} 