declare global {
  interface Window {
    __APP_CONFIG__?: {
      API_KEY?: string;
    };
  }
}

export function getConfig(): { apiKey: string } {
  if (typeof window !== "undefined" && window.__APP_CONFIG__?.API_KEY) {
    return { apiKey: window.__APP_CONFIG__.API_KEY };
  }
  // Fallback to build-time env (for local dev or if config.js hasn't loaded)
  return { apiKey: import.meta.env.VITE_API_KEY || "" };
}
