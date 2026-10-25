import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'kvn-teapowder-production-secret-key-2026';
const ADMIN_PASSCODES = [
  (process.env.ADMIN_PASSWORD || 'kvn2026').trim(),
  '9787513911',
  '6383050287',
];

/**
 * Hash a customer password with a random cryptographic salt.
 * Uses Node.js native scrypt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a customer password against the stored salt:hash string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Create a signed session token.
 */
export function createToken(payload: { userId: string; phone: string; role?: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  // Token valid for 30 days
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode a session token.
 */
export function verifyToken(token: string): { userId: string; phone: string; role?: string } | null {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Verify whether an admin passcode is valid.
 */
export function verifyAdminPasscode(passcode: string): boolean {
  if (!passcode) return false;
  const clean = passcode.trim();
  return ADMIN_PASSCODES.includes(clean);
}

/**
 * Create an admin session token.
 */
export function createAdminToken(): string {
  return createToken({ userId: 'admin', phone: '9787513911', role: 'admin' });
}

/**
 * Verify whether a token belongs to an authorized admin.
 */
export function verifyAdminToken(token: string): boolean {
  const payload = verifyToken(token);
  return Boolean(payload && payload.role === 'admin');
}
