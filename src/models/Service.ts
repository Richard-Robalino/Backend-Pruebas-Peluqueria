import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IService extends Document {
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  precio: number;
  duracionMin: number;
  activo: boolean;

}

const ServiceSchema = new Schema<IService>({
  nombre:      { type: String, required: true, trim: true },
  codigo:      { type: String, required: true, unique: true, index: true, trim: true },
  descripcion: { type: String, default: '' },
  precio:      { type: Number, required: true, min: 0 },
  duracionMin: { type: Number, required: true, min: 5, max: 480 }, // ✅ alinea con Joi
  activo:      { type: Boolean, default: true },
  
}, { timestamps: true });

export const ServiceModel: Model<IService> = mongoose.model<IService>('Service', ServiceSchema);
