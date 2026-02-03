import { describe, expect, it } from 'vitest';
import { isTokenExpired } from './auth';

function b64url(input: string) {
  // Node provides Buffer under Vitest; keep it simple.
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(expUnixSeconds: number) {
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ exp: expUnixSeconds }));
  return `${header}.${payload}.`;
}

describe('utils/auth.isTokenExpired', () => {
  it('returns false if exp missing', () => {
    const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({}));
    const token = `${header}.${payload}.`;
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true when exp is in past (with skew)', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt(now - 10);
    expect(isTokenExpired(token, 0)).toBe(true);
  });

  it('respects skewSeconds', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt(now + 10);
    expect(isTokenExpired(token, 30)).toBe(true);
    expect(isTokenExpired(token, 0)).toBe(false);
  });
});
