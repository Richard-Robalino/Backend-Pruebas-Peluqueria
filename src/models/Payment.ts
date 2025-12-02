import mongoose, { Schema, Document, Model } from 'mongoose';
import { PaymentMethod } from './Booking.js';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface IPayment extends Document {
  bookingId: mongoose.Types.ObjectId;
  amount: number;
  currency: 'USD';
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string;   // código de transacción / referencia bancaria
  cardBrand?: string;        // VISA, MASTERCARD, etc
  cardLast4?: string;        // últimos 4 dígitos
  createdBy: mongoose.Types.ObjectId;
}

const PaymentSchema = new Schema<IPayment>({
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  method: { type: String, enum: ['CARD', 'TRANSFER_PICHINCHA'], required: true },
  status: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },
  transactionRef: { type: String },
  cardBrand: { type: String },
  cardLast4: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

PaymentSchema.index({ bookingId: 1, status: 1 });

export const PaymentModel: Model<IPayment> =
  mongoose.model<IPayment>('Payment', PaymentSchema);
