// Input validation utilities for security
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

export const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { isValid: false, message: 'Password must be less than 128 characters' };
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  return { isValid: true };
};

export const validate2FACode = (code: string): boolean => {
  return /^[0-9]{6}$/.test(code);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const validateName = (name: string): boolean => {
  return name.length >= 1 && name.length <= 100 && /^[a-zA-Z\s\-']+$/.test(name);
};

// Rate limiting for client-side protection
export class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  canAttempt(key: string, maxAttempts: number = 5, windowMs: number = 300000): boolean {
    const now = Date.now();
    const attempt = this.attempts.get(key);
    
    if (!attempt || now > attempt.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (attempt.count >= maxAttempts) {
      return false;
    }
    
    attempt.count++;
    return true;
  }
  
  getRemainingTime(key: string): number {
    const attempt = this.attempts.get(key);
    if (!attempt) return 0;
    return Math.max(0, attempt.resetTime - Date.now());
  }
}

export const authRateLimiter = new RateLimiter();