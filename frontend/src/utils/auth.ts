type JwtPayload = {
  exp?: number;
};

export type CurrentUser = {
  id: number;
  username: string;
  full_name?: string | null;
  role: string;
  is_active?: boolean;
};

const decodeBase64Url = (input: string) => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  return atob(padded);
};

const parseJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    return JSON.parse(decodeBase64Url(payloadPart));
  } catch {
    return null;
  }
};

export const getToken = () => localStorage.getItem('token');

export const getUser = (): CurrentUser | null => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
};

export const getUserRole = (): string | null => getUser()?.role ?? null;

export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const hasAnyRole = (roles: string[]) => {
  const role = getUserRole();
  if (!role) return false;
  return roles.includes(role);
};

export const isTokenExpired = (token: string, skewSeconds = 30) => {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + skewSeconds;
};
