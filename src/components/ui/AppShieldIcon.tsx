import React from 'react';
import icon from '../../assets/icon.png';

interface AppShieldIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const AppShieldIcon: React.FC<AppShieldIconProps> = ({ size = 24, className, style }) => {
  return (
    <img
      src={icon}
      alt="Shield"
      width={size}
      height={size}
      className={className}
      style={{ 
        objectFit: 'contain', 
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style 
      }}
    />
  );
};
