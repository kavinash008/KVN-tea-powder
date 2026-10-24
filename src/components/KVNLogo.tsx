import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'compact' | 'white';
  size?: 'sm' | 'md' | 'lg';
  hideTaglineOnMobile?: boolean;
}

export const KVNLogo: React.FC<LogoProps> = ({
  className = '',
  variant = 'full',
  size = 'md',
  hideTaglineOnMobile = true,
}) => {
  const isWhite = variant === 'white';

  const badgeSizeClasses = {
    sm: 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg',
    md: 'w-9 h-9 sm:w-11 sm:h-11 rounded-xl',
    lg: 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl',
  };

  const svgSizeClasses = {
    sm: 'w-4 h-4 sm:w-5 sm:h-5',
    md: 'w-5 h-5 sm:w-7 sm:h-7',
    lg: 'w-7 h-7 sm:w-9 sm:h-9',
  };

  const kvnTextClasses = {
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-xl',
    lg: 'text-xl sm:text-2xl',
  };

  const teaTextClasses = {
    sm: 'text-[9px] sm:text-[10px]',
    md: 'text-[10px] sm:text-xs',
    lg: 'text-xs sm:text-sm',
  };

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-2.5 select-none ${className}`}>
      {/* Brand Monogram Badge */}
      <div 
        className={`relative flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-300 ${
          badgeSizeClasses[size]
        } ${
          isWhite 
            ? 'bg-amber-100/10 border border-amber-200/30 text-amber-200' 
            : 'bg-gradient-to-br from-[#143728] to-[#204e37] border border-[#2a6347]/40 text-[#f7e6c4]'
        }`}
      >
        <svg 
          viewBox="0 0 48 48" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className={svgSizeClasses[size]}
        >
          {/* Tea leaf flourish */}
          <path 
            d="M24 6C17 12 15 21 17 29C19 23 23 18 29 16C29 16 27 24 22 28C26 27 30 24 33 20C32 28 25 33 21 34" 
            stroke="currentColor" 
            strokeWidth="2.2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          {/* Coffee bean curve accent */}
          <path 
            d="M16 35C20 40 28 41 33 37C37 34 38 29 36 24" 
            stroke="#d4a362" 
            strokeWidth="2" 
            strokeLinecap="round" 
          />
          {/* Center coffee bean fissure */}
          <path 
            d="M24 33C25 35 27 36 29 37" 
            stroke="#d4a362" 
            strokeWidth="1.8" 
            strokeLinecap="round" 
          />
        </svg>
      </div>

      {/* Brand Text */}
      {variant !== 'compact' && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span 
              className={`font-serif-brand font-bold tracking-wider ${
                kvnTextClasses[size]
              } ${isWhite ? 'text-white' : 'text-[#143728]'}`}
            >
              KVN
            </span>
            <span 
              className={`font-semibold tracking-widest uppercase ${
                teaTextClasses[size]
              } ${isWhite ? 'text-amber-200/90' : 'text-[#8b5a2b]'}`}
            >
              TEAPOWDER
            </span>
          </div>
          <span 
            className={`tracking-widest uppercase text-[8px] sm:text-[9px] mt-0.5 font-medium ${
              hideTaglineOnMobile ? 'hidden sm:block' : 'block'
            } ${
              isWhite ? 'text-emerald-200/60' : 'text-[#588b69]'
            }`}
          >
            Purity & Taste in Every Sip
          </span>
        </div>
      )}
    </div>
  );
};
