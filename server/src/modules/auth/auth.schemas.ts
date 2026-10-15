import { z } from 'zod';

const email = z.string('Enter your email.').trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254));

const newPassword = z.string('Choose a password.').min(8, 'Use at least 8 characters.').max(200);

export const signupBody = z.object({
  fullName: z.string('Enter your name.').trim().min(1, 'Enter your name.').max(100),
  email,
  password: newPassword,
});

export const loginBody = z.object({
  email,
  password: z.string('Enter your password.').min(1, 'Enter your password.').max(200),
});

export const forgotPasswordBody = z.object({ email });

export const resetPasswordBody = z.object({
  token: z.string('This reset link is incomplete.').min(20, 'This reset link is incomplete.').max(200),
  password: newPassword,
});

export const changePasswordBody = z.object({
  currentPassword: z.string('Enter your current password.').min(1, 'Enter your current password.').max(200),
  newPassword,
});

export type SignupInput = z.infer<typeof signupBody>;
export type LoginInput = z.infer<typeof loginBody>;
