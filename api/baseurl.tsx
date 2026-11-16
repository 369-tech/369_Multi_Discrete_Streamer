const getBaseUrl = (): string => {
  // Use the FastAPI backend directly for development.
  if (import.meta.env.DEV) {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:8000`;
  }

  // Production / Live
  return '';
};

export const BASE_URL = getBaseUrl();

// Optional helper to check environment
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;