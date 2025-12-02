// src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function assertServiceRoleKey(k: string) {
  try {
    const payload = JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString('utf8'));
    if (payload.role !== 'service_role') {
      throw new Error(`La key no es service_role, es: ${payload.role}`);
    }
  } catch (e) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY inválida o mal formateada.');
  }
}
assertServiceRoleKey(key);

export const supabase = createClient(url, key, { auth: { persistSession: false } });

// util para sacar URL pública
export function publicUrlFromPath(path: string): string {
  const bucket = process.env.SUPABASE_BUCKET_SERVICES || 'services';
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Logs de depuración (quítalos luego)
console.log('[SB] url:', url);
console.log('[SB] key role: service_role (ok)');
console.log('[SB] bucket:', process.env.SUPABASE_BUCKET_SERVICES || 'services');
