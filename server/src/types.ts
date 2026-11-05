import type { User } from '@prisma/client';

export type PublicUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
};

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
      sessionId?: string;
    }
  }
}

export {};
