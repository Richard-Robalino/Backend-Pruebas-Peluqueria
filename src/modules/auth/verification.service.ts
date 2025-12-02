// src/modules/auth/verification.service.ts
import crypto from 'crypto'
import { EmailVerificationTokenModel } from '../../models/EmailVerificationToken.js'
import { IUser } from '../../models/User.js'
import { sendEmail } from '../../utils/email.js'

// Lee env aquí para no depender de un módulo env propio (evita ciclos)
const { BASE_URL, API_PREFIX } = process.env

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function buildVerifyUrl(rawToken: string): string {
  const baseUrl = (BASE_URL || 'http://localhost:4000').replace(/\/+$/, '')
  const apiPrefix = (API_PREFIX ?? '/api/v1').replace(/\/+$/, '')
  const path = `${apiPrefix}/auth/verify-email?token=${encodeURIComponent(rawToken)}`
  // asegurar una sola barra entre base y path
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

export async function createAndSendVerification(user: IUser): Promise<void> {
  const raw = generateRawToken()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

  // Upsert: 1 token por usuario, con throttle de 90s
  const existing = await EmailVerificationTokenModel.findOne({ userId: user._id })
  if (existing) {
    const now = Date.now()
    if (existing.lastSentAt && (now - existing.lastSentAt.getTime()) < 90 * 1000) {
      // throttle: no reenviar tan seguido
      return
    }
    existing.tokenHash = tokenHash
    existing.expiresAt = expiresAt
    existing.lastSentAt = new Date()
    await existing.save()
  } else {
    await EmailVerificationTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      lastSentAt: new Date()
    })
  }

  const verifyUrl = buildVerifyUrl(raw)
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111">
      <h2>Confirma tu correo</h2>
      <p>Hola ${user.nombre || ''},</p>
      <p>Gracias por registrarte. Por favor confirma tu correo haciendo clic en el siguiente botón:</p>
      <p>
        <a href="${verifyUrl}" style="background:#0d6efd;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">
          Confirmar correo
        </a>
      </p>
      <p>O copia y pega este enlace en tu navegador:<br/><code>${verifyUrl}</code></p>
      <p style="color:#555">Este enlace expirará en 24 horas.</p>
    </div>
  `
  await sendEmail(user.email, 'Confirma tu correo electrónico', html)
}

export async function verifyByRawToken(raw: string): Promise<{ ok: boolean; message: string; userId?: string; }> {
  const tokenHash = hashToken(raw)
  const tokenDoc = await EmailVerificationTokenModel.findOne({ tokenHash })
  if (!tokenDoc) return { ok: false, message: 'Token inválido' }

  if (tokenDoc.expiresAt < new Date()) {
    await tokenDoc.deleteOne()
    return { ok: false, message: 'El enlace ha expirado. Solicita uno nuevo.' }
  }

  const uid = tokenDoc.userId.toString()
  await tokenDoc.deleteOne()
  return { ok: true, message: 'Correo verificado correctamente', userId: uid }
}
