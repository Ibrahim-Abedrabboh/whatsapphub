import { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string | { ar: string; en: string };
  subtitle?: string | { ar: string; en: string };
  trend?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatCard({ icon, value, label, subtitle, trend, size = 'md', className = '' }: StatCardProps) {
  const renderText = (text: string | { ar: string; en: string }) => {
    if (typeof text === 'string') return <span>{text}</span>;
    return (
      <>
        <span data-lang="ar">{text.ar}</span>
        <span data-lang="en">{text.en}</span>
      </>
    );
  };

  return (
    <div className={`stat-card stat-card--${size} ${className}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__body">
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{renderText(label)}</div>
        {subtitle && <div className="stat-card__subtitle">{renderText(subtitle)}</div>}
        {trend !== undefined && trend !== 0 && (
          <div className={`stat-card__trend stat-card__trend--${trend > 0 ? 'up' : 'down'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
