import { z } from 'zod';

/* 账号是登录凭据：3–32 位，字母数字下划线短横线，统一小写。
   邮箱只是辅助信息（找回密码用），可以不填。 */
const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, '账号至少 3 位')
  .max(32, '账号最长 32 位')
  .regex(/^[a-z0-9_-]+$/, '账号只能用字母、数字、下划线、短横线');

const emailStrict = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(120)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, '邮箱格式不对');

export const registerSchema = z.object({
  username,
  password: z.string().min(5, '密码至少 5 位').max(128, '密码最长 128 位'),
  email: z.union([z.literal(''), emailStrict]).optional(),
  name: z.string().trim().min(1).max(30).optional(),
});

export const loginSchema = z.object({
  account: z.string().trim().toLowerCase().min(1, '请输入账号').max(120),
  password: z.string().min(1, '请输入密码').max(128),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, '昵称不能为空').max(30, '昵称最长 30 字').optional(),
    email: z.union([z.literal(''), emailStrict]).optional(),
    currentPassword: z.string().max(128).optional(),
    newPassword: z.string().min(5, '密码至少 5 位').max(128).optional(),
  })
  .refine((v) => !v.newPassword || !!v.currentPassword, {
    message: '改密码需要先填当前密码',
    path: ['currentPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
