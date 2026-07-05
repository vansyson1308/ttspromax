/**
 * Centralized Error Service
 * 
 * Provides consistent error handling, logging, and user feedback
 * across the entire TTS Pro application.
 */

import toast from "react-hot-toast";

export type ErrorCategory = 
  | 'network' 
  | 'api' 
  | 'validation' 
  | 'model' 
  | 'audio' 
  | 'storage' 
  | 'unknown';

export interface AppError {
  category: ErrorCategory;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface ErrorHandlingOptions {
  /** Show toast notification to user */
  showToast?: boolean;
  /** Log to console */
  logToConsole?: boolean;
  /** Send to analytics/error tracking service */
  trackError?: boolean;
  /** Recovery action or fallback */
  fallback?: () => void;
}

class ErrorService {
  private static instance: ErrorService;
  private errorListeners: ((error: AppError) => void)[] = [];

  private constructor() {}

  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  /**
   * Create a standardized application error
   */
  createError(
    category: ErrorCategory,
    message: string,
    code?: string,
    details?: Record<string, unknown>
  ): AppError {
    return {
      category,
      message,
      code,
      details,
      timestamp: Date.now(),
    };
  }

  /**
   * Handle an error with consistent behavior
   */
  handleError(
    error: Error | AppError | string,
    options: ErrorHandlingOptions = {}
  ): AppError {
    const {
      showToast = true,
      logToConsole = true,
      trackError = true,
      fallback
    } = options;

    // Convert to AppError if needed
    const appError = this.normalizeError(error);

    // Log to console
    if (logToConsole) {
      this.logError(appError);
    }

    // Show toast notification
    if (showToast) {
      this.showErrorToast(appError);
    }

    // Track error (could be sent to analytics service)
    if (trackError) {
      this.trackError(appError);
    }

    // Notify listeners
    this.notifyListeners(appError);

    // Execute fallback if provided
    if (fallback) {
      try {
        fallback();
      } catch (fallbackError) {
        console.warn('Error in fallback handler:', fallbackError);
      }
    }

    return appError;
  }

  /**
   * Handle network errors specifically
   */
  handleNetworkError(error: Error, url?: string): AppError {
    return this.handleError(
      this.createError('network', `Network error: ${error.message}`, 'NETWORK_ERROR', { url }),
      {
        showToast: true,
        logToConsole: true,
        trackError: true,
        fallback: () => {
          // Could implement retry logic or offline mode
        }
      }
    );
  }

  /**
   * Handle API errors specifically
   */
  handleApiError(response: Response, endpoint?: string): AppError {
    const status = response.status;
    let message = `API error: HTTP ${status}`;
    const code = `API_${status}`;

    switch (status) {
      case 400:
        message = 'Invalid request';
        break;
      case 401:
        message = 'Authentication required';
        break;
      case 403:
        message = 'Access forbidden';
        break;
      case 404:
        message = 'Resource not found';
        break;
      case 429:
        message = 'Too many requests';
        break;
      case 500:
        message = 'Server error';
        break;
      case 503:
        message = 'Service unavailable';
        break;
    }

    return this.handleError(
      this.createError('api', message, code, { endpoint, status }),
      {
        showToast: true,
        logToConsole: true,
        trackError: true,
      }
    );
  }

  /**
   * Handle model loading/execution errors
   */
  handleModelError(error: Error, modelName?: string): AppError {
    return this.handleError(
      this.createError('model', `Model error: ${error.message}`, 'MODEL_ERROR', { modelName }),
      {
        showToast: true,
        logToConsole: true,
        trackError: true,
      }
    );
  }

  /**
   * Handle audio processing errors
   */
  handleAudioError(error: Error, operation?: string): AppError {
    return this.handleError(
      this.createError('audio', `Audio error: ${error.message}`, 'AUDIO_ERROR', { operation }),
      {
        showToast: true,
        logToConsole: true,
        trackError: true,
      }
    );
  }

  /**
   * Add error listener
   */
  addListener(listener: (error: AppError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove error listener
   */
  removeListener(listener: (error: AppError) => void): void {
    this.errorListeners = this.errorListeners.filter(l => l !== listener);
  }

  private normalizeError(error: Error | AppError | string): AppError {
    if (typeof error === 'string') {
      return this.createError('unknown', error);
    }

    if ('category' in error && 'message' in error) {
      return error as AppError;
    }

    return this.createError('unknown', error.message);
  }

  private logError(error: AppError): void {
    const logMessage = `[${error.category.toUpperCase()}] ${error.message}`;
    
    if (error.category === 'network' || error.code?.includes('NETWORK')) {
      console.warn(logMessage, error.details);
    } else {
      console.error(logMessage, error.details);
    }
  }

  private showErrorToast(error: AppError): void {
    // Map error categories to user-friendly messages
    let userMessage = error.message;
    
    // Remove technical prefixes for user display
    userMessage = userMessage
      .replace(/^(Network|API|Model|Audio|Validation) error: /, '')
      .replace(/^Error: /, '');

    toast.error(userMessage, {
      duration: 5000,
      position: 'top-center',
    });
  }

  private trackError(error: AppError): void {
    // Hook for plugging in Sentry / LogRocket / custom analytics later.
    void error;
  }

  private notifyListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.warn('Error in error listener:', listenerError);
      }
    });
  }
}

// Export singleton instance
export const errorService = ErrorService.getInstance();

// Convenience functions for common error patterns
export const handleError = (error: Error | AppError | string, options?: ErrorHandlingOptions) => 
  errorService.handleError(error, options);

export const handleNetworkError = (error: Error, url?: string) =>
  errorService.handleNetworkError(error, url);

export const handleApiError = (response: Response, endpoint?: string) =>
  errorService.handleApiError(response, endpoint);

export const handleModelError = (error: Error, modelName?: string) =>
  errorService.handleModelError(error, modelName);

export const handleAudioError = (error: Error, operation?: string) =>
  errorService.handleAudioError(error, operation);