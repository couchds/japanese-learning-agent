import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { 
  generateToken, 
  sendVerificationEmail, 
  send2FACode 
} from '../services/emailService';
import {
  create2FACode,
  verify2FACode,
  enable2FA as enableTwoFA,
  disable2FA as disableTwoFA,
} from '../services/twoFactorService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// POST /api/auth/signup - Register a new user
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;

    // Validation
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, password, and email are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate verification token
    const verification_token = generateToken();
    const verification_token_expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // In development mode, auto-verify emails if email service is not configured
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const hasEmailService = !!process.env.RESEND_API_KEY;
    const autoVerify = isDevelopment && !hasEmailService;

    // Create user
    const user = await prisma.users.create({
      data: {
        username,
        email,
        password_hash,
        verification_token: autoVerify ? null : verification_token,
        verification_token_expiry: autoVerify ? null : verification_token_expiry,
        email_verified: autoVerify, // Auto-verify in dev mode without email service
        twofa_enabled: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        email_verified: true,
        twofa_enabled: true,
      },
    });

    // Send verification email only if email service is configured
    if (!autoVerify) {
      try {
        await sendVerificationEmail(email, username, verification_token);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails to send
      }
    } else {
      console.log(`[DEV] User ${username} auto-verified (email service not configured)`);
    }

    res.status(201).json({
      message: autoVerify 
        ? 'Registration successful. You can now log in.' 
        : 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        email_verified: user.email_verified,
        twofa_enabled: user.twofa_enabled,
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') { // Prisma unique constraint violation
      const target = error.meta?.target;
      if (target && target.includes('username')) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      if (target && target.includes('email')) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/verify-email - Verify email address
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user with this token
    const user = await prisma.users.findFirst({
      where: {
        verification_token: token,
        verification_token_expiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Update user to verified
    await prisma.users.update({
      where: {
        id: user.id,
      },
      data: {
        email_verified: true,
        verification_token: null,
        verification_token_expiry: null,
      },
    });

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a verification link has been sent.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification token
    const verification_token = generateToken();
    const verification_token_expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.users.update({
      where: { id: user.id },
      data: {
        verification_token,
        verification_token_expiry,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.username, verification_token);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login - Login user (step 1: credentials)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { login, password } = req.body; // 'login' can be username or email

    // Validation
    if (!login || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    // Find user by username or email
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { username: login },
          { email: login },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({ 
        error: 'Email not verified. Please check your email for the verification link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Check if 2FA is enabled
    if (user.twofa_enabled) {
      // Generate and send 2FA code
      const code = await create2FACode(user.id);
      
      try {
        await send2FACode(user.email, user.username, code);
      } catch (emailError) {
        console.error('Failed to send 2FA code:', emailError);
        return res.status(500).json({ error: 'Failed to send 2FA code' });
      }

      return res.json({
        message: '2FA code sent to your email',
        requires2FA: true,
        userId: user.id, // Temporary, will be removed after 2FA verification
      });
    }

    // No 2FA required, generate token immediately
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        email_verified: user.email_verified,
        twofa_enabled: user.twofa_enabled,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/verify-2fa - Verify 2FA code (step 2 of login)
router.post('/verify-2fa', async (req: Request, res: Response) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ error: 'User ID and code are required' });
    }

    // Verify the 2FA code
    const isValid = await verify2FACode(userId, code);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired 2FA code' });
    }

    // Get user data
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        email_verified: true,
        twofa_enabled: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        email_verified: user.email_verified,
        twofa_enabled: user.twofa_enabled,
      },
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me - Get current user (requires authentication)
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.users.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        email_verified: true,
        twofa_enabled: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/enable-2fa - Enable 2FA for current user
router.post('/enable-2fa', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.users.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.twofa_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    await enableTwoFA(user.id);

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/disable-2fa - Disable 2FA for current user
router.post('/disable-2fa', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.users.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twofa_enabled) {
      return res.status(400).json({ error: '2FA is already disabled' });
    }

    await disableTwoFA(user.id);

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy endpoint for backward compatibility
// GET /api/auth/verify - Verify JWT token
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };

    // Get user data
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        email_verified: true,
        twofa_enabled: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
