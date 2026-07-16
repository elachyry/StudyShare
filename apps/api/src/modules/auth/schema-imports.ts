// Convenience barrel: shared auth schemas + zod, used by the auth routes.
export { z } from 'zod';
export {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  authTokensSchema,
  authUserSchema,
  okSchema,
} from '@studyshare/shared';
