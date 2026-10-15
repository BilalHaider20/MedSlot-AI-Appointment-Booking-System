import { z } from 'zod';

const email = z.string('Enter your email.').trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254));

export const signupBody = z.object({
  fullName: z.string('Enter your name.').trim().min(1, 'Enter your name.').max(100),
  email,
  password: z.string('Choose a password.').min(8, 'Use at least 8 characters.').max(200),
});

export const loginBody = z.object({
  email,
  password: z.string('Enter your password.').min(1, 'Enter your password.').max(200),
});

export type SignupInput = z.infer<typeof signupBody>;
export type LoginInput = z.infer<typeof loginBody>;
