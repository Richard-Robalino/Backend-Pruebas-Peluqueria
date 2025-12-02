export const ROLES = {
  ADMIN: 'ADMIN',
  GERENTE: 'GERENTE',
  ESTILISTA: 'ESTILISTA',
  CLIENTE: 'CLIENTE'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
