import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'glass';
  className?: string;
  hover?: boolean;
}

export function Card({ children, variant = 'default', className = '', hover = false }: CardProps) {
  const variantClass = variant !== 'default' ? `card--${variant}` : '';
  
  return (
    <div 
      className={`card ${variantClass} ${className}`}
      style={{ cursor: hover ? 'pointer' : undefined }}
    >
      {children}
    </div>
  );
}
