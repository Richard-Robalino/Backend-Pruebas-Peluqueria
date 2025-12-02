import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import PDFDocument from 'pdfkit';

import { BookingModel } from '../../models/Booking.js';
import { RatingModel } from '../../models/Rating.js';
import { PaymentModel } from '../../models/Payment.js';
import { ServiceModel } from '../../models/Service.js';
import { UserModel } from '../../models/User.js';
import { ApiError } from '../../middlewares/errorHandler.js';
import { StatusCodes } from 'http-status-codes';
import { BOOKING_STATUS } from '../../constants/statuses.js';

// ================== HELPERS DE FECHAS ==================

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

const TZ = 'America/Guayaquil';

function normalizeDateRange(
  period: Period,
  from?: string,
  to?: string
): { start?: Date; end?: Date; label: string } {
  const now = new Date();
  let start: Date | undefined;
  let end: Date | undefined;
  let label = '';

  if (period === 'custom') {
    start = from ? new Date(from) : undefined;
    end = to ? new Date(to) : undefined;
    label = `Personalizado ${from ?? ''} - ${to ?? ''}`;
    return { start, end, label };
  }

  if (period === 'day') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
    label = 'Hoy';
  } else if (period === 'week') {
    const day = now.getDay(); // 0 domingo
    const diffToMonday = (day + 6) % 7;
    start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    label = 'Semana actual';
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    label = 'Mes actual';
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    label = 'Año actual';
  }

  return { start, end, label };
}

// Expresión para agrupar pagos según periodo
function getPeriodGroupId(period: Period) {
  if (period === 'day' || period === 'custom') {
    return {
      $dateToString: {
        format: '%Y-%m-%d',
        date: '$reportDate',
        timezone: TZ
      }
    };
  }
  if (period === 'month') {
    return {
      $dateToString: {
        format: '%Y-%m',
        date: '$reportDate',
        timezone: TZ
      }
    };
  }
  if (period === 'year') {
    return {
      $dateToString: {
        format: '%Y',
        date: '$reportDate',
        timezone: TZ
      }
    };
  }
  // week: año + semana ISO
  return {
    $concat: [
      { $toString: { $isoWeekYear: '$reportDate' } },
      '-W',
      {
        $toString: { $isoWeek: '$reportDate' }
      }
    ]
  };
}

// ================== AGREGACIONES BASE ==================

// Ingresos del local agrupados por periodo
async function aggregateRevenueByPeriod(period: Period, start?: Date, end?: Date) {
  const pipeline: any[] = [
    {
      $addFields: {
        reportDate: { $ifNull: ['$fecha', '$createdAt'] },
        reportAmount: { $ifNull: ['$amount', '$monto'] }
      }
    },
    {
      $match: {
        status: 'PAID'
      }
    }
  ];

  const dateMatch: any = {};
  if (start) dateMatch.$gte = start;
  if (end) dateMatch.$lte = end;
  if (start || end) {
    pipeline.push({
      $match: {
        reportDate: dateMatch
      }
    });
  }

  pipeline.push({
    $group: {
      _id: getPeriodGroupId(period),
      total: { $sum: '$reportAmount' },
      count: { $sum: 1 }
    }
  });

  pipeline.push({ $sort: { _id: 1 } });

  const rows = await PaymentModel.aggregate(pipeline);
  return rows.map(r => ({
    period: r._id,
    total: r.total,
    count: r.count
  }));
}

// Ingresos por estilista
async function aggregateRevenueByStylist(start?: Date, end?: Date) {
  const pipeline: any[] = [
    {
      $addFields: {
        reportDate: { $ifNull: ['$fecha', '$createdAt'] },
        reportAmount: { $ifNull: ['$amount', '$monto'] }
      }
    },
    {
      $match: {
        status: 'PAID'
      }
    }
  ];

  const dateMatch: any = {};
  if (start) dateMatch.$gte = start;
  if (end) dateMatch.$lte = end;
  if (start || end) {
    pipeline.push({
      $match: {
        reportDate: dateMatch
      }
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'booking'
      }
    },
    { $unwind: '$booking' },
    {
      $lookup: {
        from: 'users',
        localField: 'booking.estilistaId',
        foreignField: '_id',
        as: 'stylist'
      }
    },
    { $unwind: '$stylist' },
    {
      $group: {
        _id: '$stylist._id',
        stylistName: {
          $first: {
            $concat: ['$stylist.nombre', ' ', { $ifNull: ['$stylist.apellido', ''] }]
          }
        },
        totalRevenue: { $sum: '$reportAmount' },
        bookingsCount: { $sum: 1 }
      }
    },
    { $sort: { totalRevenue: -1 } }
  );

  return PaymentModel.aggregate(pipeline);
}

// Servicios más vendidos (por ingresos)
async function aggregateTopServices(start?: Date, end?: Date) {
  const pipeline: any[] = [
    {
      $addFields: {
        reportDate: { $ifNull: ['$fecha', '$createdAt'] },
        reportAmount: { $ifNull: ['$amount', '$monto'] }
      }
    },
    {
      $match: { status: 'PAID' }
    }
  ];

  const dateMatch: any = {};
  if (start) dateMatch.$gte = start;
  if (end) dateMatch.$lte = end;
  if (start || end) {
    pipeline.push({
      $match: {
        reportDate: dateMatch
      }
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'booking'
      }
    },
    { $unwind: '$booking' },
    {
      $lookup: {
        from: 'services',
        localField: 'booking.servicioId',
        foreignField: '_id',
        as: 'service'
      }
    },
    { $unwind: '$service' },
    {
      $group: {
        _id: '$service._id',
        serviceName: { $first: '$service.nombre' },
        totalRevenue: { $sum: '$reportAmount' },
        bookingsCount: { $sum: 1 }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 }
  );

  return PaymentModel.aggregate(pipeline);
}

// Citas por estado (para el rango)
async function aggregateBookingsByStatus(start?: Date, end?: Date) {
  const match: any = {};
  if (start || end) {
    match.inicio = {};
    if (start) match.inicio.$gte = start;
    if (end) match.inicio.$lte = end;
  }

  const pipeline: any[] = [];
  if (Object.keys(match).length) pipeline.push({ $match: match });

  pipeline.push({
    $group: {
      _id: '$estado',
      count: { $sum: 1 }
    }
  });

  return BookingModel.aggregate(pipeline);
}

// Ratings por estilista
async function aggregateRatingsByStylist(start?: Date, end?: Date) {
  const match: any = {};
  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    if (end) match.createdAt.$lte = end;
  }

  const pipeline: any[] = [];
  if (Object.keys(match).length) pipeline.push({ $match: match });

  pipeline.push(
    {
      $lookup: {
        from: 'users',
        localField: 'estilistaId',
        foreignField: '_id',
        as: 'stylist'
      }
    },
    { $unwind: '$stylist' },
    {
      $group: {
        _id: '$stylist._id',
        stylistName: {
          $first: {
            $concat: ['$stylist.nombre', ' ', { $ifNull: ['$stylist.apellido', ''] }]
          }
        },
        avgRating: { $avg: '$estrellas' },
        ratingsCount: { $sum: 1 }
      }
    },
    { $sort: { avgRating: -1 } }
  );

  return RatingModel.aggregate(pipeline);
}

// ================== ENDPOINTS JSON ==================

export async function summaryReports(req: Request, res: Response, next: NextFunction) {
  try {
    const { period = 'month', from, to } = req.query as any;
    const { start, end, label } = normalizeDateRange(period as Period, from, to);

    const [
      revenueByPeriod,
      revenueByStylist,
      topServices,
      bookingsByStatus,
      ratingsByStylist
    ] = await Promise.all([
      aggregateRevenueByPeriod(period as Period, start, end),
      aggregateRevenueByStylist(start, end),
      aggregateTopServices(start, end),
      aggregateBookingsByStatus(start, end),
      aggregateRatingsByStylist(start, end)
    ]);

    const totalRevenue = revenueByPeriod.reduce((acc, r) => acc + (r.total || 0), 0);
    const totalBookings = revenueByStylist.reduce((acc, r) => acc + (r.bookingsCount || 0), 0);

    res.json({
      range: { period, from: start, to: end, label },
      totals: {
        totalRevenue,
        totalBookings
      },
      revenueByPeriod,
      revenueByStylist,
      topServices,
      bookingsByStatus,
      ratingsByStylist
    });
  } catch (err) {
    next(err);
  }
}

// Solo ingresos (por periodo) en JSON
export async function revenueReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { period = 'month', from, to } = req.query as any;
    const { start, end, label } = normalizeDateRange(period as Period, from, to);

    const revenueByPeriod = await aggregateRevenueByPeriod(period as Period, start, end);
    res.json({ range: { period, from: start, to: end, label }, revenueByPeriod });
  } catch (err) {
    next(err);
  }
}

// Solo ingresos por estilista en JSON
export async function stylistRevenueReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { period = 'month', from, to } = req.query as any;
    const { start, end, label } = normalizeDateRange(period as Period, from, to);

    const revenueByStylist = await aggregateRevenueByStylist(start, end);
    res.json({ range: { period, from: start, to: end, label }, revenueByStylist });
  } catch (err) {
    next(err);
  }
}

// ================== PDF PROFESIONAL ==================

// Dibujo de gráfico de barras simple en PDF
function drawBarChart(
  doc: any,   // 👈 antes poníamos PDFDocument aquí
  title: string,
  data: { label: string; value: number }[],
  maxBars: number = 8
) {
  if (!data.length) {
    doc.fontSize(12).text(`${title}: sin datos`, { underline: true });
    doc.moveDown();
    return;
  }

  const sliced = data.slice(0, maxBars);

  doc.addPage();
  doc.fontSize(16).text(title, { underline: true });
  doc.moveDown();

  const chartLeft = 60;
  const chartTop = doc.y + 10;
  const chartWidth = 480;
  const chartHeight = 200;

  const maxValue = Math.max(...sliced.map(d => d.value), 1);
  const barWidth = chartWidth / sliced.length - 10;

  // Ejes
  doc.moveTo(chartLeft, chartTop)
    .lineTo(chartLeft, chartTop + chartHeight)
    .stroke();

  doc.moveTo(chartLeft, chartTop + chartHeight)
    .lineTo(chartLeft + chartWidth, chartTop + chartHeight)
    .stroke();

  sliced.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = chartLeft + index * (barWidth + 10);
    const y = chartTop + chartHeight - barHeight;

    doc.rect(x, y, barWidth, barHeight).fillOpacity(0.4).fill();
    doc.fillOpacity(1);

    // Etiqueta abajo
    doc.fontSize(8).text(item.label, x, chartTop + chartHeight + 2, {
      width: barWidth,
      align: 'center'
    });

    // Valor encima
    doc.fontSize(9).text(item.value.toFixed(2), x, y - 12, {
      width: barWidth,
      align: 'center'
    });
  });

  doc.moveDown(4);
}

// “Pastel” muy simple: solo porcentajes de bookings por estado
function drawPieLikeSummary(
  doc: any,   // 👈 igual aquí
  title: string,
  data: { label: string; value: number }[]
) {
  doc.addPage();
  doc.fontSize(16).text(title, { underline: true });
  doc.moveDown();

  const total = data.reduce((acc, d) => acc + d.value, 0) || 1;

  data.forEach(d => {
    const pct = (d.value / total) * 100;
    doc
      .fontSize(12)
      .text(`• ${d.label}: ${d.value} (${pct.toFixed(1)}%)`);
  });

  doc.moveDown(2);
}


// Reporte PDF general
export async function downloadReportsPdf(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { period = 'month', from, to } = req.query as any;
    const { start, end, label } = normalizeDateRange(period as Period, from, to);

    const [
      revenueByPeriod,
      revenueByStylist,
      topServices,
      bookingsByStatus,
      ratingsByStylist
    ] = await Promise.all([
      aggregateRevenueByPeriod(period as Period, start, end),
      aggregateRevenueByStylist(start, end),
      aggregateTopServices(start, end),
      aggregateBookingsByStatus(start, end),
      aggregateRatingsByStylist(start, end)
    ]);

    const totalRevenue = revenueByPeriod.reduce((acc, r) => acc + (r.total || 0), 0);
    const totalBookings = revenueByStylist.reduce((acc, r) => acc + (r.bookingsCount || 0), 0);

    const filename = `reporte-${period}-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    // Portada
    const shopName = process.env.INVOICE_SHOP_NAME || 'Mi Peluquería';
    doc.fontSize(22).text(`Reporte del local - ${shopName}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Rango: ${label}`, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text(`Generado: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.addPage();
    doc.fontSize(18).text('Resumen general', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Ingresos totales: $${totalRevenue.toFixed(2)}`);
    doc.fontSize(12).text(`Número de citas (pagadas): ${totalBookings}`);
    doc.moveDown(2);

    // Tabla simple de ingresos por periodo
    doc.fontSize(14).text('Ingresos por período', { underline: true });
    doc.moveDown(0.5);
    revenueByPeriod.forEach(r => {
      doc.fontSize(11).text(
        `${r.period}: $${(r.total || 0).toFixed(2)} en ${r.count} pago(s)`
      );
    });

    doc.moveDown(2);

    // Tabla de ingresos por estilista
    doc.fontSize(14).text('Ingresos por estilista', { underline: true });
    doc.moveDown(0.5);
    revenueByStylist.forEach((r: any) => {
      doc
        .fontSize(11)
        .text(
          `${r.stylistName}: $${(r.totalRevenue || 0).toFixed(2)} en ${r.bookingsCount} cita(s)`
        );
    });

    doc.moveDown(2);

    // Top servicios
    doc.fontSize(14).text('Top servicios por ingresos', { underline: true });
    doc.moveDown(0.5);
    topServices.forEach((r: any) => {
      doc
        .fontSize(11)
        .text(
          `${r.serviceName}: $${(r.totalRevenue || 0).toFixed(2)} en ${r.bookingsCount} cita(s)`
        );
    });

    // Gráfico de barras: ingresos por período
    const barDataPeriod = revenueByPeriod.map(r => ({
      label: String(r.period),
      value: Number(r.total || 0)
    }));
    drawBarChart(doc, 'Gráfico de barras - Ingresos por período', barDataPeriod);

    // Gráfico de barras: ingresos por estilista
    const barDataStylist = (revenueByStylist as any[]).map(r => ({
      label: r.stylistName,
      value: Number(r.totalRevenue || 0)
    }));
    drawBarChart(doc, 'Gráfico de barras - Ingresos por estilista', barDataStylist);

    // “Pastel” de estado de citas
    const pieDataStatus = (bookingsByStatus as any[]).map(r => ({
      label: r._id || 'SIN_ESTADO',
      value: r.count
    }));
    drawPieLikeSummary(doc, 'Distribución de citas por estado', pieDataStatus);

    // Ratings por estilista
    doc.addPage();
    doc.fontSize(16).text('Rating promedio por estilista', { underline: true });
    doc.moveDown();
    (ratingsByStylist as any[]).forEach(r => {
      doc
        .fontSize(11)
        .text(
          `${r.stylistName}: ${r.avgRating.toFixed(2)} ⭐ (${r.ratingsCount} reseña(s))`
        );
    });

    doc.end();
  } catch (err) {
    next(err);
  }
}
