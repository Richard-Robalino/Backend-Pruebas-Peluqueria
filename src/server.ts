import { connect } from './config/db.js';
import app from './app.js';
import { env } from './config/env.js';
import { startAppointmentReminderJob } from './jobs/reminders.js';
import { verifyEmailTransport } from './utils/email.js';
import 'dotenv/config';


async function bootstrap() {
  await connect();
  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
    // Inicializar job de recordatorios de citas
    startAppointmentReminderJob();
  });

  // Graceful shutdown
  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

bootstrap().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
verifyEmailTransport()