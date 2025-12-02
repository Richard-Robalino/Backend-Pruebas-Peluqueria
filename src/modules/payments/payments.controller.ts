import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';

import { BookingModel } from '../../models/Booking.js';
import { PaymentModel } from '../../models/Payment.js';
import { ServiceModel } from '../../models/Service.js';
import { UserModel } from '../../models/User.js';
import { ApiError } from '../../middlewares/errorHandler.js';
import { ROLES } from '../../constants/roles.js';
import { BOOKING_STATUS } from '../../constants/statuses.js';
import { generateInvoicePdf } from './invoice.service.js';
import { sendEmailWithAttachment } from '../../utils/email.js';

// ------------------ HELPERS ------------------

function generateTransferReference(bookingId: string) {
  const shortId = bookingId.slice(-6).toUpperCase();
  return `RES-${shortId}`;
}

function generateInvoiceNumber(bookingId: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const shortId = bookingId.slice(-6).toUpperCase();
  return `FCT-${y}${m}${d}-${shortId}`;
}

// ======================================================
// 1) GENERAR ORDEN DE PAGO POR TRANSFERENCIA
// ======================================================

/**
 * POST /api/v1/payments/booking/:id/transfer-request
 *
 * - Crea / reutiliza un Payment PENDING por transferencia
 * - Devuelve datos de la cuenta al cliente
 * - Envía correo al ADMIN con PDF + botón "Confirmar pago"
 */
export async function requestTransferPayment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user!;
    const bookingId = req.params.id;

    if (!mongoose.isValidObjectId(bookingId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'ID de reserva inválido');
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Reserva no encontrada');

    // Solo CLIENTE dueño, ADMIN o GERENTE
    if (user.role === ROLES.CLIENTE && booking.clienteId.toString() !== user.id) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado');
    }

    if (
      user.role !== ROLES.CLIENTE &&
      user.role !== ROLES.ADMIN &&
      user.role !== ROLES.GERENTE
    ) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Rol no autorizado');
    }

    // No generar orden si ya está pagada
    if (booking.paymentStatus === 'PAID') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Esta reserva ya está pagada');
    }

    // No generar si la reserva está cancelada / no-show
    if (
      booking.estado === BOOKING_STATUS.CANCELLED ||
      booking.estado === BOOKING_STATUS.NO_SHOW
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'No se puede generar orden de pago para una reserva cancelada o no-show'
      );
    }

    // Obtener servicio para monto
    const service = await ServiceModel.findById(booking.servicioId).lean();
    if (!service || !service.precio) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Servicio inválido o sin precio');
    }

    const amount = Number(service.precio);
    if (amount <= 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'El valor del servicio debe ser mayor a 0');
    }

    // Generar referencia de transferencia
    const reference = generateTransferReference(booking.id);

    // Crear o reutilizar Payment en PENDING (TRANSFER_PICHINCHA)
    let payment = await PaymentModel.findOne({
      bookingId: booking._id,
      method: 'TRANSFER_PICHINCHA',
      status: 'PENDING'
    });

    if (!payment) {
      payment = await PaymentModel.create({
        bookingId: booking._id,
        amount,
        currency: 'USD',
        method: 'TRANSFER_PICHINCHA',
        status: 'PENDING',
        transactionRef: reference,
        createdBy: new mongoose.Types.ObjectId(user.id)
      });
    }

    // Datos de la cuenta del negocio (desde .env)
    const bankInfo = {
      bank: 'Banco Pichincha',
      accountType: 'Cuenta corriente',
      accountNumber: process.env.PICHINCHA_ACCOUNT_NUMBER || '0000000000',
      accountHolder: process.env.PICHINCHA_ACCOUNT_HOLDER || 'Nombre de la empresa',
      reference // <- lo que el cliente debe poner en el concepto de la transferencia
    };

    // ---------- 📧 EMAIL AL ADMIN CON PDF Y BOTÓN ----------

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const [client, stylist] = await Promise.all([
        UserModel.findById(booking.clienteId).select('nombre apellido email'),
        UserModel.findById(booking.estilistaId).select('nombre apellido email')
      ]);

      const invoiceNumber = generateInvoiceNumber(booking.id);
      const issuedAt = new Date(); // fecha de emisión de la ORDEN (no pago confirmado)

      const pdfBuffer = await generateInvoicePdf({
        booking,
        client: client || null,
        stylist: stylist || null,
        service: {
          nombre: service.nombre,
          duracionMin: service.duracionMin,
          precio: amount
        },
        payment: {
          invoiceNumber,
          method: 'TRANSFER_PICHINCHA',
          paidAt: issuedAt,
          amount
        }
      });

      const baseConfirmUrl =
        process.env.ADMIN_CONFIRM_URL_BASE ||
        'http://localhost:4200/admin/payments/confirm';

      const confirmUrl =
        `${baseConfirmUrl}?bookingId=${booking.id}&paymentId=${payment.id}`;

      const clientName =
        client ? `${client.nombre} ${client.apellido || ''}` : 'Cliente';

      const fechaTexto = booking.inicio.toLocaleString();
      const servicioTexto = service.nombre;

      const htmlAdmin = `
        <p>Se ha generado una <b>nueva orden de pago por transferencia</b>.</p>
        <p><b>Cliente:</b> ${clientName}</p>
        <p><b>Servicio:</b> ${servicioTexto}</p>
        <p><b>Fecha y hora de la cita:</b> ${fechaTexto}</p>
        <p><b>Monto a pagar:</b> $${amount.toFixed(2)}</p>
        <p><b>Banco:</b> Banco Pichincha</p>
        <p><b>Número de cuenta:</b> ${bankInfo.accountNumber}</p>
        <p><b>Titular:</b> ${bankInfo.accountHolder}</p>
        <p><b>Referencia que debe usar el cliente:</b> ${bankInfo.reference}</p>
        <br/>
        <p>Cuando verifiques la transferencia en la cuenta, puedes confirmar el pago aquí:</p>
        <p>
          <a href="${confirmUrl}"
             style="
                display:inline-block;
                padding:10px 18px;
                background-color:#0d6efd;
                color:#ffffff;
                text-decoration:none;
                border-radius:6px;
                font-weight:bold;
             ">
            ✅ Confirmar pago
          </a>
        </p>
        <p style="font-size:12px;color:#666;">
          (Este botón debe llevarte al panel administrativo, desde donde se llamará al endpoint
          <code>/api/v1/payments/booking/:id/confirm-transfer</code>).
        </p>
      `;

      await sendEmailWithAttachment(
        adminEmail,
        'Nueva orden de pago por transferencia',
        htmlAdmin,
        pdfBuffer,
        `orden-pago-${invoiceNumber}.pdf`
      );
    }

    // ---------- RESPUESTA AL CLIENTE ----------
    res.json({
      message: 'Generada solicitud de pago por transferencia',
      bookingId: booking.id,
      paymentId: payment.id,
      amount,
      bankInfo
    });

  } catch (err) { next(err); }
}

// ======================================================
// 2) CONFIRMAR TRANSFERENCIA (ADMIN/GERENTE) + FACTURA AL CLIENTE
// ======================================================

/**
 * POST /api/v1/payments/booking/:id/confirm-transfer
 *
 * - Solo ADMIN/GERENTE
 * - Marca Payment PENDING -> PAID
 * - Marca Booking como pagada + CONFIRMED
 * - Envía PDF de factura SOLO al cliente
 */
export async function confirmTransferPayment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user!;
    const bookingId = req.params.id;

    if (!mongoose.isValidObjectId(bookingId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'ID de reserva inválido');
    }

    if (user.role !== ROLES.ADMIN && user.role !== ROLES.GERENTE) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Solo ADMIN/GERENTE pueden confirmar transferencias');
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Reserva no encontrada');

    // Buscar pago pendiente de transferencia
    const payment = await PaymentModel.findOne({
      bookingId: booking._id,
      method: 'TRANSFER_PICHINCHA',
      status: 'PENDING'
    });

    if (!payment) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'No hay pago pendiente por transferencia para esta reserva');
    }

    // Servicio para monto / info
    const service = await ServiceModel.findById(booking.servicioId).lean();
    if (!service || !service.precio) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Servicio inválido o sin precio');
    }

    const amount = Number(service.precio);

    // Generar número de factura
    const invoiceNumber = generateInvoiceNumber(booking.id);
    const paidAt = new Date();

    // Marcar pago como PAID
    payment.status = 'PAID';
    payment.amount = amount;
    await payment.save();

    // Actualizar booking
    booking.precio = amount;
    booking.paymentStatus = 'PAID';
    booking.paymentMethod = 'TRANSFER_PICHINCHA';
    booking.paidAt = paidAt;
    booking.invoiceNumber = invoiceNumber;
    booking.estado = BOOKING_STATUS.CONFIRMED;
    booking.actualizadoPor = new mongoose.Types.ObjectId(user.id);
    await booking.save();

    // Datos cliente y estilista
    const [client, stylist] = await Promise.all([
      UserModel.findById(booking.clienteId).select('nombre apellido email'),
      UserModel.findById(booking.estilistaId).select('nombre apellido email')
    ]);

    // Generar PDF de FACTURA (pago confirmado)
    const pdfBuffer = await generateInvoicePdf({
      booking,
      client: client || null,
      stylist: stylist || null,
      service: {
        nombre: service.nombre,
        duracionMin: service.duracionMin,
        precio: amount
      },
      payment: {
        invoiceNumber,
        method: 'TRANSFER_PICHINCHA',
        paidAt,
        amount
      }
    });

    const fechaTexto = booking.inicio.toLocaleString();
    const servicioTexto = service.nombre;

    // -------- 📧 SOLO AL CLIENTE --------
    if (client?.email) {
      const htmlCliente = `
        <p>Tu pago por transferencia ha sido <b>confirmado</b>.</p>
        <p><b>Servicio:</b> ${servicioTexto}</p>
        <p><b>Fecha y hora de la cita:</b> ${fechaTexto}</p>
        <p><b>Total pagado:</b> $${amount.toFixed(2)}</p>
        <p><b>Factura:</b> ${invoiceNumber}</p>
        <p>Adjuntamos tu factura en PDF.</p>
      `;

      await sendEmailWithAttachment(
        client.email,
        'Pago confirmado y cita reservada',
        htmlCliente,
        pdfBuffer,
        `factura-${invoiceNumber}.pdf`
      );
    }

    res.json({
      message: 'Transferencia confirmada, pago registrado y cita confirmada',
      bookingId: booking.id,
      paymentId: payment.id,
      invoiceNumber
    });

  } catch (err) { next(err); }
}
