/**
 * In-memory access-token store. The access token is deliberately NOT persisted
 * to localStorage (XSS-exfiltration risk); it lives only in memory and is
 * re-obtained via the httpOnly refresh cookie on page load / expiry.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null): void => {
    accessToken = token;
  },
  clear: (): void => {
    accessToken = null;
  },
};
