import type { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';

const storage = multer.memoryStorage(); // buffer en memoria; lo subimos a Supabase

const maxMb = Number(process.env.UPLOAD_MAX_MB ?? 2);
const allowedMimes = (process.env.UPLOAD_ALLOWED_MIME ?? 'image/jpeg,image/png,image/webp')
  .split(',')                // ✅ separar por coma (no por '.')
  .map(s => s.trim())
  .filter(Boolean);

export const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error(`Tipo de archivo no permitido (${file.mimetype})`));
    }
    cb(null, true);
  }
});
