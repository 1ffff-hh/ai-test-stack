import { z } from 'zod';

const baseEmail = z.string().trim().toLowerCase().min(3).max(120);

/* 注册要求真实邮箱格式；登录放宽到 user@host，
   否则内置的 admin@localhost 这类本机账号永远登不进去。 */
const emailStrict = baseEmail.regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, '邮箱格式不对');
const emailLoose = baseEmail.regex(/^[^@\s]+@[^@\s]+$/, '邮箱格式不对');

export const registerSchema = z.object({
  email: emailStrict,
  password: z.string().min(8, '密码至少 8 位').max(128, '密码最长 128 位'),
  name: z.string().trim().min(1).max(30).optional(),
});

export const loginSchema = z.object({
  email: emailLoose,
  password: z.string().min(1, '请输入密码').max(128),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, '昵称不能为空').max(30, '昵称最长 30 字').optional(),
    currentPassword: z.string().max(128).optional(),
    newPassword: z.string().min(8).max(128).optional(),
  })
  .refine((v) => !v.newPassword || !!v.currentPassword, {
    message: '改密码需要先填当前密码',
    path: ['currentPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
