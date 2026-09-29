import { z } from "zod";

export const createUserSchema = z.object({
  email: z.email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export type CreateUserSchemaType = z.infer<typeof createUserSchema>;
