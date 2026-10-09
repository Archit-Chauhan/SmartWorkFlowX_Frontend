import React from 'react';

interface LogoMarkProps {
  className?: string;
}

/**
 * Fork X: two flow paths that cross to form the X in SmartWorkFlowX.
 * Ink follows the surrounding text color; the accent follows --logo-accent (falls back to --accent).
 */
export const LogoMark: React.FC<LogoMarkProps> = ({ className = 'h-8 w-8' }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path d="M10 11C27 11 21 37 38 37" stroke="currentColor" strokeWidth="3.5" />
    <path d="M10 37C27 37 21 11 38 11" stroke="var(--logo-accent, var(--accent))" strokeWidth="3.5" />
    <circle cx="10" cy="11" r="3.6" fill="currentColor" />
    <circle cx="10" cy="37" r="3.6" fill="var(--logo-accent, var(--accent))" />
    <circle cx="38" cy="37" r="3.6" fill="currentColor" />
    <circle cx="38" cy="11" r="3.6" fill="var(--logo-accent, var(--accent))" />
  </svg>
);

interface LogoProps {
  className?: string;
  markClassName?: string;
}

/** Mark plus wordmark. The wordmark is a single text node so it reads as "SmartWorkFlow" + accent X. */
export const Logo: React.FC<LogoProps> = ({ className = '', markClassName = 'h-7 w-7' }) => (
  <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
    <LogoMark className={markClassName} />
    <span>
      SmartWorkFlow<span style={{ color: 'var(--logo-accent, var(--accent))' }}>X</span>
    </span>
  </span>
);

export default Logo;
