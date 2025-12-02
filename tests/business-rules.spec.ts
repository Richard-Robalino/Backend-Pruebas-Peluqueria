import { describe, it, expect } from 'vitest';

function canCancel(hoursBefore: number, isClient: boolean) {
  if (!isClient) return true;
  return hoursBefore >= 12;
}

describe('Reglas de negocio', () => {
  it('Cliente no puede cancelar con menos de 12h', () => {
    expect(canCancel(11.9, true)).toBe(false);
    expect(canCancel(12, true)).toBe(true);
  });
  it('Admin/Gerente puede cancelar siempre', () => {
    expect(canCancel(0.5, false)).toBe(true);
  });
});
