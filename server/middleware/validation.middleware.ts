import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export interface ValidatedRequest<T = any> extends Request {
  validatedBody?: T;
  validatedQuery?: any;
  validatedParams?: any;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: z.ZodError,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Generic validation middleware factory
export const validateRequest = <T>(
  schema: z.ZodSchema<T>,
  target: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: ValidatedRequest<T>, res: Response, next: NextFunction) => {
    try {
      let dataToValidate: any;
      
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      const validatedData = schema.parse(dataToValidate);
      
      // Attach validated data to request
      if (target === 'body') {
        req.validatedBody = validatedData;
      } else if (target === 'query') {
        req.validatedQuery = validatedData;
      } else if (target === 'params') {
        req.validatedParams = validatedData;
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      
      console.error('Unexpected validation error:', error);
      return res.status(500).json({
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
};

// Common validation schemas

// Email validation
export const emailSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email must not exceed 255 characters')
    .transform(email => email.toLowerCase().trim())
});

// Authentication schemas
export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(5, 'Email must be at least 5 characters')
    .transform(email => email.toLowerCase().trim()),
  password: z.string()
    .min(1, 'Password is required')
    .optional() // Optional during transition period
});

// ECOS Session schemas
export const createEcosSessionSchema = z.object({
  scenarioId: z.string()
    .min(1, 'Scenario ID is required')
    .max(255, 'Scenario ID too long'),
  studentEmail: z.string()
    .email('Invalid student email format')
    .transform(email => email.toLowerCase().trim())
    .optional()
});

export const ecosMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message content is required')
    .max(10000, 'Message too long (max 10,000 characters)'),
  role: z.enum(['user', 'assistant', 'system'])
    .default('user'),
  type: z.enum(['text', 'image', 'file'])
    .default('text')
});

export const ecosEvaluationSchema = z.object({
  criteria: z.record(z.string(), z.number().min(0).max(100))
    .optional()
    .default({}),
  responses: z.array(z.string())
    .optional()
    .default([]),
  notes: z.string()
    .max(5000, 'Notes too long (max 5,000 characters)')
    .optional()
});

// Student creation schema
export const createStudentSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email must not exceed 255 characters')
    .transform(email => email.toLowerCase().trim()),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
  role: z.enum(['student', 'teacher'])
    .default('student')
});

// Query parameter schemas
export const emailQuerySchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .transform(email => email.toLowerCase().trim())
});

export const paginationQuerySchema = z.object({
  page: z.string()
    .regex(/^\d+$/, 'Page must be a number')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, 'Page must be greater than 0')
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .default('20')
});

// URL parameter schemas
export const sessionIdParamSchema = z.object({
  sessionId: z.string()
    .min(1, 'Session ID is required')
    .regex(/^session_\d+_[a-z0-9]+$/, 'Invalid session ID format')
});

export const userIdParamSchema = z.object({
  userId: z.string()
    .min(1, 'User ID is required')
    .max(255, 'User ID too long')
});

// Scenario schemas
export const scenarioQuerySchema = z.object({
  category: z.string()
    .max(50, 'Category too long')
    .optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert'])
    .optional(),
  tags: z.string()
    .transform(str => str.split(',').map(tag => tag.trim()).filter(Boolean))
    .optional()
});

// Training session schemas
export const createTrainingSessionSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title too long'),
  description: z.string()
    .max(1000, 'Description too long')
    .optional(),
  scenarioIds: z.array(z.string())
    .min(1, 'At least one scenario is required')
    .max(10, 'Too many scenarios (max 10)'),
  studentEmails: z.array(z.string().email())
    .min(1, 'At least one student email is required')
    .max(50, 'Too many students (max 50)')
});

// Comprehensive validation middleware for common patterns
export const validateEmailQuery = validateRequest(emailQuerySchema, 'query');
export const validateEmailBody = validateRequest(emailSchema, 'body');
export const validateLogin = validateRequest(loginSchema, 'body');
export const validateCreateStudent = validateRequest(createStudentSchema, 'body');
export const validateCreateEcosSession = validateRequest(createEcosSessionSchema, 'body');
export const validateEcosMessage = validateRequest(ecosMessageSchema, 'body');
export const validateEcosEvaluation = validateRequest(ecosEvaluationSchema, 'body');
export const validateSessionIdParam = validateRequest(sessionIdParamSchema, 'params');
export const validatePaginationQuery = validateRequest(paginationQuerySchema, 'query');
export const validateScenarioQuery = validateRequest(scenarioQuerySchema, 'query');
export const validateCreateTrainingSession = validateRequest(createTrainingSessionSchema, 'body');

// Sanitization helpers
export const sanitizeString = (str: string, maxLength: number = 1000): string => {
  return str
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/\s+/g, ' '); // Normalize whitespace
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

// Request size validation middleware
export const validateRequestSize = (maxSizeBytes: number = 1024 * 1024) => { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');
    
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      return res.status(413).json({
        error: 'Request too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: `${Math.round(maxSizeBytes / 1024)}KB`
      });
    }
    
    next();
  };
};

// Content type validation middleware
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get('content-type');
    
    if (req.method !== 'GET' && req.method !== 'DELETE' && !contentType) {
      return res.status(400).json({
        error: 'Content-Type header required',
        code: 'CONTENT_TYPE_REQUIRED'
      });
    }
    
    if (contentType && !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        error: 'Unsupported media type',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        allowedTypes
      });
    }
    
    next();
  };
};