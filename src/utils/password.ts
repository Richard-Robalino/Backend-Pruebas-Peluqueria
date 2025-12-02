import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}[\]|;:'",.<>/?]).{8,}$/;
