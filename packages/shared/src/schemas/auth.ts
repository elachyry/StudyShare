import { z } from 'zod';
import { roleSchema, userStatusSchema } from '../enums.js';

/** Emails are always compared/stored lowercased. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

/**
 * Password policy (also enforced server-side with zxcvbn strength scoring):
 * min 10 chars with a mix of character classes. The regex is a fast structural
 * gate; the zxcvbn check on the server rejects weak-but-compliant passwords.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200)
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[0-9]/, 'Must include a number')
  .regex(/[^A-Za-z0-9]/, 'Must include a symbol');

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().min(2).max(80),
  })
  .strict();
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(200),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(10) }).strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
  })
  .strict();
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: passwordSchema,
  })
  .strict();
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Public representation of the authenticated user (never includes secrets). */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  status: userStatusSchema,
  branchId: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Login/refresh success payload. Access token is returned in the body and kept
 * in memory by the client; the refresh token is set as an httpOnly cookie. */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
