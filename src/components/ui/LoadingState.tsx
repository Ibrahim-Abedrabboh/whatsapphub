interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-overlay__content">
        <div className={`spinner spinner--${size}`} />
        {message && <div className="loading-overlay__text">{message}</div>}
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`spinner spinner--${size}`} />;
}

export function LoadingSkeleton({ type = 'text', count = 1 }: { type?: 'text' | 'title' | 'card' | 'circle'; count?: number }) {
  const skeletons = Array.from({ length: count }, (_, i) => (
    <div key={i} className={`skeleton skeleton--${type}`} />
  ));
  
  return <>{skeletons}</>;
}
