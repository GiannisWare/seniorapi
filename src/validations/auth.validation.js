import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(255),
  email: z.email().trim().min(2).max(255).toLowerCase(),
  password: z.string().trim().min(6).max(128),
  role: z.enum(['user', 'admin']).default('user'),
});

export const signInSchema = z.object({
  email: z.email().toLowerCase().trim(),
  password: z.string().min(1),
});
