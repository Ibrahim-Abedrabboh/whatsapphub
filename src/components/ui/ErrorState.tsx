import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  errorCode?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export function ErrorState({
  title = 'Something Went Wrong',
  message,
  errorCode,
  onRetry,
  onGoHome,
}: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-state__icon">⚠️</div>
      <h3 className="error-state__title">{title}</h3>
      <p className="error-state__message">{message}</p>
      {errorCode && (
        <div className="error-state__code">Error: {errorCode}</div>
      )}
      <div className="error-state__actions">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try Again
          </Button>
        )}
        {onGoHome && (
          <Button variant="ghost" onClick={onGoHome}>
            Go Home
          </Button>
        )}
      </div>
    </div>
  );
}
