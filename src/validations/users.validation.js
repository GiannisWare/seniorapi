import { z } from 'zod';

export const userIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    email: z.email().trim().max(255).toLowerCase().optional(),
    role: z.enum(['user', 'admin']).optional(),
  })
  .strict()
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'At least one field must be provided',
  });
