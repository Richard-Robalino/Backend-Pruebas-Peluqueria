import PDFDocument from 'pdfkit';
import { IBooking } from '../../models/Booking.js';
import { IUser } from '../../models/User.js';
import { Document as MDoc } from 'mongoose';

interface ServiceData {
  nombre: string;
  duracionMin: number;
  precio: number;
}

interface PaymentInfo {
  invoiceNumber: string;
  method: 'CARD' | 'TRANSFER_PICHINCHA';
  paidAt: Date;
  amount: number;
}

interface GenerateInvoiceParams {
  booking: IBooking & MDoc;
  client: IUser | null;
  stylist: IUser | null;
  service: ServiceData;
  payment: PaymentInfo;
}

export function generateInvoicePdf({
  booking,
  client,
  stylist,
  service,
  payment
}: GenerateInvoiceParams): Promise<Buffer> {

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const shopName = process.env.INVOICE_SHOP_NAME || 'Mi Peluquería';
    const shopAddress = process.env.INVOICE_SHOP_ADDRESS || 'Dirección de la peluquería';
    const shopRuc = process.env.INVOICE_SHOP_RUC || 'RUC: 9999999999';

    // HEADER
    doc
      .fontSize(20)
      .text(shopName, { align: 'left' });

    doc
      .fontSize(10)
      .text(shopAddress)
      .text(shopRuc);

    doc
      .fontSize(18)
      .text(`FACTURA #${payment.invoiceNumber}`, { align: 'right' });

    doc.moveDown();

    // Datos de factura
    doc
      .fontSize(12)
      .text(`Fecha de emisión: ${payment.paidAt.toLocaleString()}`)
      .text(`Método de pago: ${payment.method === 'CARD' ? 'Tarjeta' : 'Transferencia Banco Pichincha'}`)
      .text(`ID de reserva: ${booking.id}`);

    doc.moveDown();

    // CLIENTE
    doc.fontSize(14).text('Datos del cliente', { underline: true });
    doc.fontSize(12);

   if (client) {
  doc.text(`Nombre: ${client.nombre} ${client.apellido || ''}`);
  doc.text(`Email: ${client.email}`);
} else {
  // Fallback por si el usuario fue borrado u otro caso raro
  doc.text('Nombre: Cliente');
}

doc.moveDown();


    // ESTILISTA
    doc.fontSize(14).text('Datos del estilista', { underline: true });
    doc.fontSize(12);
    if (stylist) {
      doc.text(`Nombre: ${stylist.nombre} ${stylist.apellido || ''}`);
      doc.text(`Email: ${stylist.email}`);
    }

    doc.moveDown();

    // DETALLE DE LA CITA
    doc.fontSize(14).text('Detalle de la cita', { underline: true });
    doc.fontSize(12);

    doc.text(`Fecha y hora: ${booking.inicio.toLocaleString()}`);
    doc.text(`Duración: ${service.duracionMin} minutos`);

    doc.moveDown();

    // TABLA simple
    doc.fontSize(14).text('Detalle de servicios', { underline: true });
    doc.moveDown(0.5);

    // Encabezado
    doc.fontSize(12).text('Servicio', 50, doc.y, { continued: true });
    doc.text('Duración (min)', 250, doc.y, { continued: true });
    doc.text('Precio', 400, doc.y);
    doc.moveDown();

    // Línea
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Fila única (un servicio por booking)
    doc.text(service.nombre, 50, doc.y, { continued: true });
    doc.text(String(service.duracionMin), 250, doc.y, { continued: true });
    doc.text(`$${service.precio.toFixed(2)}`, 400, doc.y);

    doc.moveDown();

    // TOTAL
    doc.moveDown();
    doc
      .fontSize(14)
      .text(`TOTAL: $${payment.amount.toFixed(2)}`, { align: 'right' });

    doc.end();
  });
}
