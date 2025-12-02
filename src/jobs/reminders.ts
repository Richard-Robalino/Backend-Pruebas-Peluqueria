import { BookingModel } from '../models/Booking.js';
import { ServiceModel } from '../models/Service.js';
import { UserModel } from '../models/User.js';
import { BOOKING_STATUS } from '../constants/statuses.js';
import { sendEmail } from '../utils/email.js';
import { NotificationModel } from '../models/Notification.js';

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short' }).format(d);
}

export function startAppointmentReminderJob() {
  // Ejecuta cada 60s
  setInterval(async () => {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 30 * 60 * 1000); // +30 min
      const windowEnd = new Date(now.getTime() + 31 * 60 * 1000); // +31 min ventana 1 min

      const bookings = await BookingModel.find({
        inicio: { $gte: windowStart, $lt: windowEnd },
        estado: { $in: [BOOKING_STATUS.SCHEDULED, BOOKING_STATUS.CONFIRMED] },
        reminder30Sent: { $ne: true }
      });

      for (const b of bookings) {
        const cliente = await UserModel.findById(b.clienteId);
        if (!cliente || !cliente.email || (cliente as any).isActive === false) continue;
        const estilista = await UserModel.findById(b.estilistaId);
        const servicio = await ServiceModel.findById(b.servicioId);

        const html = `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
            <h2>Recordatorio de cita (30 minutos)</h2>
            <p>Hola ${cliente.nombre || 'cliente'},</p>
            <p>Tu cita comenzará en <b>30 minutos</b>.</p>
            <ul>
              <li><b>Servicio:</b> ${servicio?.nombre ?? '—'}</li>
              <li><b>Estilista:</b> ${estilista ? estilista.nombre + ' ' + (estilista.apellido ?? '') : '—'}</li>
              <li><b>Fecha y hora:</b> ${formatDate(b.inicio)}</li>
              ${b.precio ? `<li><b>Precio:</b> $${b.precio.toFixed(2)}</li>` : ''}
              ${b.notas ? `<li><b>Notas:</b> ${b.notas}</li>` : ''}
            </ul>
            <p>¡Te esperamos!</p>
          </div>
        `;

        await sendEmail(cliente.email, 'Tu cita comienza en 30 minutos', html);
        await NotificationModel.create({ userId: cliente._id as any, type: 'EMAIL', title: 'Recordatorio de cita', message: 'Tu cita comienza en 30 minutos', sentAt: new Date() });
        b.reminder30Sent = true;
        await (b as any).save();
      }
    } catch (err) {
      console.error('Reminder job error', err);
    }
  }, 60 * 1000);
}
