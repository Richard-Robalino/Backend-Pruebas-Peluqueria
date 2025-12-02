import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRating extends Document {
  bookingId: mongoose.Types.ObjectId;
  clienteId: mongoose.Types.ObjectId;
  estilistaId: mongoose.Types.ObjectId;
  estrellas: number; // 1..5
  comentario?: string;
}

const RatingSchema = new Schema<IRating>({
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  clienteId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  estilistaId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  estrellas: { type: Number, min: 1, max: 5, required: true },
  comentario: { type: String, maxlength: 70 }
}, { timestamps: true });

export const RatingModel: Model<IRating> = mongoose.model<IRating>('Rating', RatingSchema);
