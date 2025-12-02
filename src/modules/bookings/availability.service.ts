import mongoose from 'mongoose';
import { ServiceSlotModel } from '../../models/ServiceSlot.js';
import { BookingModel } from '../../models/Booking.js';
import { BOOKING_STATUS } from '../../constants/statuses.js';

const WEEKDAYS = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO'
] as const;

const ACTIVE_STATES = [
  BOOKING_STATUS.SCHEDULED,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.IN_PROGRESS,
  BOOKING_STATUS.PENDING_STYLIST_CONFIRMATION
];

function getDayLabel(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

function buildDateTimeForSlot(dateStr: string, minutesFromMidnight: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dt = new Date(year, month - 1, day, 0, 0, 0, 0);
  dt.setMinutes(dt.getMinutes() + minutesFromMidnight);
  return dt;
}

/**
 * Calcula la disponibilidad de un servicio usando los slots
 * date: "YYYY-MM-DD"
 */
export async function computeAvailability(
  dateStr: string,
  serviceId: string,
  stylistId?: string
) {
  if (!mongoose.isValidObjectId(serviceId)) return [];

  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return [];

  const dayDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  const dayLabel = getDayLabel(dayDate);

  const slotFilter: any = {
    service: serviceId,
    dayOfWeek: dayLabel,
    isActive: true
  };
  if (stylistId && mongoose.isValidObjectId(stylistId)) {
    slotFilter.stylist = stylistId;
  }

  const slots: any[] = await ServiceSlotModel.find(slotFilter)
    .populate('stylist', 'nombre apellido')
    .sort({ startMin: 1 });

  if (!slots.length) return [];

  const stylistIds = Array.from(
    new Set(slots.map(s => s.stylist?._id?.toString()).filter(Boolean))
  );

  const dayStart = dayDate;
  const dayEnd = new Date(dayDate.getTime() + 24 * 60 * 60 * 1000);

  // Citas ya reservadas ese día para esos estilistas
  const busy = await BookingModel.find({
    estilistaId: { $in: stylistIds },
    inicio: { $lt: dayEnd, $gte: dayStart },
    estado: { $in: ACTIVE_STATES }
  }).select('estilistaId inicio fin');

  const busyByStylist = new Map<string, { start: Date; end: Date }[]>();
  for (const b of busy) {
    const key = b.estilistaId.toString();
    if (!busyByStylist.has(key)) busyByStylist.set(key, []);
    busyByStylist.get(key)!.push({ start: b.inicio, end: b.fin });
  }

  const result: {
    slotId: string;
    stylistId: string;
    stylistName: string;
    start: string;
    end: string;
  }[] = [];

  for (const slot of slots) {
    const sDate = buildDateTimeForSlot(dateStr, slot.startMin);
    const eDate = buildDateTimeForSlot(dateStr, slot.endMin);
    const key = slot.stylist._id.toString();
    const busyList = busyByStylist.get(key) || [];
    const taken = busyList.some(b => b.start < eDate && b.end > sDate);
    if (!taken) {
      result.push({
        slotId: slot._id.toString(),
        stylistId: key,
        stylistName: `${slot.stylist.nombre} ${slot.stylist.apellido}`.trim(),
        start: sDate.toISOString(),
        end: eDate.toISOString()
      });
    }
  }

  return result;
}
