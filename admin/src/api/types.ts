export type Role = 'USER' | 'ADMIN';
export type Status = 'ACTIVE' | 'BANNED';

export interface User {
  id: number;
  username: string;
  email: string | null;
  name: string;
  role: Role;
  status: Status;
  createdAt: string;
}

export interface ContentItem {
  id: string;
  name?: string;
  _updatedAt?: string;
  [key: string]: unknown;
}

export interface CollectionInfo {
  key: string;
  label: string;
  count: number;
}

export interface Stats {
  users: number;
  admins: number;
  sessions: number;
  favorites: number;
  logs: number;
  collections: CollectionInfo[];
}

export interface AuditLog {
  id: number;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
  user: { email: string; name: string } | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublishResult {
  ok: boolean;
  files?: string[];
  build?: string;
  msg?: string;
  rolledBack?: boolean;
}
