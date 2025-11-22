import { PrismaClient } from '@prisma/client';
import { generate2FACode } from './emailService';

const prisma = new PrismaClient();

const CODE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a new 2FA code for a user
 */
export async function create2FACode(userId: number): Promise<string> {
  const code = generate2FACode();
  const expiresAt = new Date(Date.now() + CODE_VALIDITY_MS);

  await prisma.twofa_codes.create({
    data: {
      user_id: userId,
      code,
      expires_at: expiresAt,
      used: false,
    },
  });

  return code;
}

/**
 * Verify a 2FA code for a user
 */
export async function verify2FACode(userId: number, code: string): Promise<boolean> {
  const twofaCode = await prisma.twofa_codes.findFirst({
    where: {
      user_id: userId,
      code,
      used: false,
      expires_at: {
        gt: new Date(),
      },
    },
  });

  if (!twofaCode) {
    return false;
  }

  // Mark code as used
  await prisma.twofa_codes.update({
    where: {
      id: twofaCode.id,
    },
    data: {
      used: true,
    },
  });

  return true;
}

/**
 * Clean up expired 2FA codes (should be run periodically)
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const result = await prisma.twofa_codes.deleteMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Clean up old used codes (older than 24 hours)
 */
export async function cleanupUsedCodes(): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const result = await prisma.twofa_codes.deleteMany({
    where: {
      used: true,
      created_at: {
        lt: oneDayAgo,
      },
    },
  });

  return result.count;
}

/**
 * Enable 2FA for a user
 */
export async function enable2FA(userId: number): Promise<void> {
  await prisma.users.update({
    where: {
      id: userId,
    },
    data: {
      twofa_enabled: true,
    },
  });
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: number): Promise<void> {
  await prisma.users.update({
    where: {
      id: userId,
    },
    data: {
      twofa_enabled: false,
    },
  });

  // Clean up any pending codes for this user
  await prisma.twofa_codes.deleteMany({
    where: {
      user_id: userId,
      used: false,
    },
  });
}

export default {
  create2FACode,
  verify2FACode,
  cleanupExpiredCodes,
  cleanupUsedCodes,
  enable2FA,
  disable2FA,
};



