import nodemailer from 'nodemailer';

// Variables de entorno
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM
} = process.env;

// Puerto SMTP
const port = Number(SMTP_PORT) || 587;
const isSecure = port === 465;

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: isSecure,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Render a veces rechaza certificados
  },
  requireTLS: !isSecure,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000
});

// ---------------- EMAIL SIMPLE ----------------
export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html
    });
    console.log(`📧 Email enviado a ${to}`);
    return info;
  } catch (err) {
    console.error('❌ Error al enviar correo:', err);
    throw new Error('No se pudo enviar el correo electrónico');
  }
}

// ---------------- VERIFICACIÓN (NO DETIENE LA API) ----------------
export async function verifyEmailTransport() {
  try {
    await transporter.verify();
    console.log('✅ SMTP verificado correctamente');
  } catch (err) {
    console.error('⚠️ Advertencia: No se pudo verificar SMTP al iniciar.');
    console.error('   Pero la API continuará funcionando.');
  }
}

// ---------------- EMAIL CON ADJUNTO ----------------
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
    });

    console.log(`📧 Email con adjunto enviado a ${to}`);
    return info;
  } catch (err) {
    console.error('❌ Error al enviar correo con adjunto:', err);
    throw new Error('No se pudo enviar el correo electrónico con adjunto');
  }
}
