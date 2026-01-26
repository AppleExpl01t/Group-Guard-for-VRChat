import React, { createContext, useContext, useEffect, useState } from 'react';

// Define the shape of our Theme State
interface ThemeState {
  primaryHue: number;
  setPrimaryHue: (hue: number) => void;
  accentHue: number;
  setAccentHue: (hue: number) => void;
  glassBlur: number;
  setGlassBlur: (px: number) => void;
  uiScale: number;
  setUiScale: (scale: number) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from LocalStorage or Default
  const [primaryHue, setPrimaryHue] = useState<number>(() => parseInt(localStorage.getItem('primaryHue') || '270'));
  const [accentHue, setAccentHue] = useState<number>(() => parseInt(localStorage.getItem('accentHue') || '180'));
  const [glassBlur, setGlassBlur] = useState<number>(() => parseInt(localStorage.getItem('glassBlur') || '20'));
  const [uiScale, setUiScale] = useState<number>(() => parseFloat(localStorage.getItem('uiScale') || '1'));

  // Sync state to CSS Variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-hue', primaryHue.toString());
    localStorage.setItem('primaryHue', primaryHue.toString());
  }, [primaryHue]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-hue', accentHue.toString());
    localStorage.setItem('accentHue', accentHue.toString());
  }, [accentHue]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--glass-blur', `${glassBlur}px`);
    localStorage.setItem('glassBlur', glassBlur.toString());
  }, [glassBlur]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', uiScale.toString());
    localStorage.setItem('uiScale', uiScale.toString());
  }, [uiScale]);

  const resetTheme = () => {
    setPrimaryHue(270);
    setAccentHue(180);
    setGlassBlur(20);
    setUiScale(1);
  };

  return (
    <ThemeContext.Provider value={{ 
      primaryHue, setPrimaryHue, 
      accentHue, setAccentHue,
      glassBlur, setGlassBlur,
      uiScale, setUiScale,
      resetTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

