import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = '7d'; // 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  role?: 'customer' | 'admin' | 'employee' | 'manager' | 'cashier' | 'kitchen' | 'reception';
  userType?: 'customer' | 'admin' | 'employee';
  type?: 'customer' | 'admin' | 'employee' | 'reset'; // Alias for userType, used in some API routes
  authUserId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Generate an admin token with elevated permissions
 */
export function generateAdminToken(userId: string, email: string): string {
  return generateToken({ userId, email, role: 'admin' });
}

/**
 * Generate a password reset token (short-lived)
 */
export function generateResetToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, type: 'reset' }, JWT_SECRET, {
    expiresIn: '1h',
  });
}

/**
 * Verify if token has admin role
 */
export function isAdminToken(token: string): boolean {
  const payload = verifyToken(token);
  return payload?.role === 'admin';
}

/**
 * Extract user ID from token
 */
export function getUserIdFromToken(token: string): string | null {
  const payload = verifyToken(token);
  return payload?.userId || null;
}
