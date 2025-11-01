// Detect environment and return correct API endpoint
export const getApiEndpoint = (path: string): string => {
  // In development, use Vite dev server API routes
  if (import.meta.env.DEV) {
    return `/api${path}`;
  }
  
  // In production, use Netlify Functions
  return `/.netlify/functions${path}`;
};

export const isProduction = !import.meta.env.DEV;
export const isDevelopment = import.meta.env.DEV;
