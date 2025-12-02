import nodemailer from 'nodemailer'

// Cargar variables de entorno directamente desde process.env
// (Evita dependencia circular con ../config/env.js)
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM
} = process.env

// Definir puerto y protocolo seguro según configuración de Gmail
const port = Number(SMTP_PORT) || 587
const isSecure = port === 465 // true solo si puerto 465 (SSL)

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: isSecure,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  requireTLS: !isSecure,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000
})

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM, // Ejemplo: "Peluquería Bella <tu_correo@gmail.com>"
      to,
      subject,
      html
    })
    console.log(`📧 Email enviado correctamente a ${to}`)
    console.log('ID del mensaje:', info.messageId)
  } catch (err) {
    console.error('❌ Error al enviar correo:', err)
    throw new Error('No se pudo enviar el correo electrónico')
  }
}

export async function verifyEmailTransport() {
  try {
    await transporter.verify()
    console.log('✅ Conexión SMTP verificada con éxito')
  } catch (err) {
    console.error('❌ Error al verificar la conexión SMTP:', err)
  }
}

/**
 * Enviar correo con adjunto (por ejemplo, factura en PDF)
 * - `to`: destinatario
 * - `subject`: asunto
 * - `html`: cuerpo del correo en HTML
 * - `attachment`: Buffer del archivo (ej: PDF)
 * - `filename`: nombre del archivo (ej: "factura-001.pdf")
 * - `mimeType`: tipo MIME, por defecto "application/pdf"
 */
export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  html: string,
  attachment: Buffer,
  filename: string,
  mimeType: string = 'application/pdf'
) {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      attachments: [
        {
          filename,
          content: attachment,
          contentType: mimeType
        }
      ]
    })
    console.log(`📧 Email con adjunto enviado correctamente a ${to}`)
    console.log('ID del mensaje:', info.messageId)
  } catch (err) {
    console.error('❌ Error al enviar correo con adjunto:', err)
    throw new Error('No se pudo enviar el correo electrónico con adjunto')
  }
}
