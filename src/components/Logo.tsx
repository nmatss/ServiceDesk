import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
}

const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md', 
  variant = 'light' 
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const colorClasses = {
    light: 'text-white',
    dark: 'text-gray-900'
  };

  return (
    <div className={`flex items-center ${className}`}>
      <div className={`${sizeClasses[size]} ${colorClasses[variant]} flex items-center justify-center`}>
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Fundo escuro */}
          <rect width="32" height="32" rx="4" fill="#1a1a2e" />
          
          {/* Linhas onduladas roxas com efeito de brilho */}
          <g filter="url(#glow)">
            {/* Linha superior */}
            <path
              d="M6 12C8 8 12 8 16 12C20 16 24 16 26 12"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Linha inferior */}
            <path
              d="M6 20C8 24 12 24 16 20C20 16 24 16 26 20"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
          
          {/* Filtro de brilho */}
          <defs>
            <filter id="glow" x="-2" y="-2" width="36" height="36">
              <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
      </div>
      
      {/* Texto do logo */}
      <span className={`ml-2 text-xl font-bold ${colorClasses[variant]}`}>
        ServiceDesk
      </span>
    </div>
  );
};

export default Logo;

