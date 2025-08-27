import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    isAdmin: boolean;
    iat?: number;
    exp?: number;
  };
}

export interface JWTPayload {
  email: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

class AuthenticationService {
  private readonly jwtSecret: string;
  private readonly adminEmails: Set<string>;
  
  constructor() {
    // Use environment variable for JWT secret, fallback to a development secret
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret-key-change-in-production';
    
    if (this.jwtSecret === 'development-secret-key-change-in-production' && process.env.NODE_ENV === 'production') {
      console.error('❌ SECURITY WARNING: JWT_SECRET not set in production! This is a security risk!');
    }
    
    // Load admin emails from environment variable or use fallback
    const adminEmailsEnv = process.env.ADMIN_EMAILS;
    if (adminEmailsEnv) {
      this.adminEmails = new Set(
        adminEmailsEnv
          .split(',')
          .map(email => email.trim().toLowerCase())
          .filter(email => this.isValidEmail(email))
      );
      console.log(`✅ Loaded ${this.adminEmails.size} admin emails from environment`);
    } else {
      // Fallback for development only
      this.adminEmails = new Set(['cherubindavid@gmail.com']);
      console.warn('⚠️ Using fallback admin email for development. Set ADMIN_EMAILS environment variable.');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public generateToken(email: string): string {
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    const payload: JWTPayload = {
      email: email.toLowerCase().trim(),
      isAdmin: this.isAdmin(email)
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '24h',
      issuer: 'ecos-app',
      audience: 'ecos-users'
    });
  }

  public verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'ecos-app',
        audience: 'ecos-users'
      }) as JWTPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  public isAdmin(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    return this.adminEmails.has(email.toLowerCase().trim());
  }

  public getAdminEmails(): string[] {
    return Array.from(this.adminEmails);
  }
}

// Singleton instance
export const authService = new AuthenticationService();

// Middleware for JWT token verification
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_MISSING'
    });
  }

  try {
    const user = authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
    return res.status(403).json({ 
      error: errorMessage,
      code: 'TOKEN_INVALID'
    });
  }
};

// Middleware for admin authorization
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ 
      error: 'Admin privileges required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

// Email-based authorization (legacy support during transition)
export const isAdminAuthorized = (email: string): boolean => {
  return authService.isAdmin(email);
};

// Middleware for email-based authorization (legacy during transition)
export const authorizeByEmail = (req: Request, res: Response, next: NextFunction) => {
  const email = req.query.email as string || req.body.email as string;
  
  if (!email) {
    return res.status(400).json({ 
      error: 'Email parameter required',
      code: 'EMAIL_REQUIRED'
    });
  }

  if (!isAdminAuthorized(email)) {
    return res.status(403).json({ 
      error: 'Unauthorized access',
      code: 'EMAIL_UNAUTHORIZED'
    });
  }

  next();
};