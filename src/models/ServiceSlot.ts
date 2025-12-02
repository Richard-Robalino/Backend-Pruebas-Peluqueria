import mongoose, { Schema, Document, Model } from 'mongoose';

export type Weekday =
  | 'LUNES'
  | 'MARTES'
  | 'MIERCOLES'
  | 'JUEVES'
  | 'VIERNES'
  | 'SABADO'
  | 'DOMINGO';

export interface IServiceSlot extends Document {
  stylist: mongoose.Types.ObjectId;
  service: mongoose.Types.ObjectId;
  dayOfWeek: Weekday;   // día de la semana (no fecha)
  startMin: number;     // minutos desde 00:00 (ej: 9:00 => 540)
  endMin: number;       // minutos desde 00:00
  isActive: boolean;
}

const ServiceSlotSchema = new Schema<IServiceSlot>({
  stylist: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
    index: true
  },
  dayOfWeek: {
    type: String,
    enum: ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO'],
    required: true,
    index: true
  },
  startMin: {
    type: Number,
    required: true
  },
  endMin: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Un estilista no puede tener dos slots que se crucen en el mismo día
ServiceSlotSchema.index({ stylist: 1, dayOfWeek: 1, startMin: 1, endMin: 1 });

export const ServiceSlotModel: Model<IServiceSlot> =
  mongoose.model<IServiceSlot>('ServiceSlot', ServiceSlotSchema);
