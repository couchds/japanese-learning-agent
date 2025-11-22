import { Resend } from 'resend';
import crypto from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yomunami.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Create Resend client
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Verify configuration on startup
if (!RESEND_API_KEY) {
  console.warn('Email service not configured. Set RESEND_API_KEY environment variable.');
} else {
  console.log('Email service (Resend) is ready to send messages');
}

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a 6-digit numeric code
 */
export function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send email verification link
 */
export async function sendVerificationEmail(email: string, username: string, token: string): Promise<void> {
  if (!resend) {
    throw new Error('Email service not configured');
  }

  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
  
  try {
    await resend.emails.send({
      from: `Yomunami <${FROM_EMAIL}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Yomunami!</h1>
            </div>
            <div class="content">
              <p>Hi ${username},</p>
              <p>Thank you for signing up! Please verify your email address to activate your account.</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6b7280;">${verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create an account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Yomunami. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${username},

Thank you for signing up! Please verify your email address by visiting:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.
      `,
    });
    
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send 2FA code via email
 */
export async function send2FACode(email: string, username: string, code: string): Promise<void> {
  if (!resend) {
    throw new Error('Email service not configured');
  }

  try {
    await resend.emails.send({
      from: `Yomunami <${FROM_EMAIL}>`,
      to: email,
      subject: 'Your Two-Factor Authentication Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
            .code { font-size: 32px; font-weight: bold; text-align: center; background-color: white; padding: 20px; border-radius: 5px; letter-spacing: 5px; color: #4F46E5; margin: 20px 0; }
            .warning { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Two-Factor Authentication</h1>
            </div>
            <div class="content">
              <p>Hi ${username},</p>
              <p>You requested to sign in to your account. Please use the following code to complete your login:</p>
              <div class="code">${code}</div>
              <p style="text-align: center; color: #6b7280;">This code will expire in 5 minutes.</p>
              <div class="warning">
                <strong>Security Notice:</strong> If you didn't attempt to sign in, please ignore this email and ensure your account is secure.
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Yomunami. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${username},

You requested to sign in to your account. Please use the following code:

${code}

This code will expire in 5 minutes.

If you didn't attempt to sign in, please ignore this email.
      `,
    });
    
    console.log(`2FA code sent to ${email}`);
  } catch (error) {
    console.error('Error sending 2FA code:', error);
    throw new Error('Failed to send 2FA code');
  }
}

/**
 * Send password reset email (for future use)
 */
export async function sendPasswordResetEmail(email: string, username: string, token: string): Promise<void> {
  if (!resend) {
    throw new Error('Email service not configured');
  }

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  
  try {
    await resend.emails.send({
      from: `Yomunami <${FROM_EMAIL}>`,
      to: email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi ${username},</p>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
              <p>This link will expire in 1 hour.</p>
              <div class="warning">
                <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Yomunami. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hi ${username},

We received a request to reset your password. Visit this link to create a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.
      `,
    });
    
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

export default {
  generateToken,
  generate2FACode,
  sendVerificationEmail,
  send2FACode,
  sendPasswordResetEmail,
};
