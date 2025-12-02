import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStylistSchedule extends Document {
  stylistId: mongoose.Types.ObjectId;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  slots: { start: string; end: string }[]; // HH:mm
  exceptions?: { date: string; closed?: boolean; blocks?: { start: string; end: string }[] }[]; // date: YYYY-MM-DD
}

const StylistScheduleSchema = new Schema<IStylistSchedule>({
  stylistId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  slots: [{ start: { type: String, required: true }, end: { type: String, required: true } }],
  exceptions: [{
    date: { type: String, required: true },
    closed: { type: Boolean, default: false },
    blocks: [{ start: String, end: String }]
  }]
}, { timestamps: true });

StylistScheduleSchema.index({ stylistId: 1, dayOfWeek: 1 }, { unique: true });

export const StylistScheduleModel: Model<IStylistSchedule> = mongoose.model<IStylistSchedule>('StylistSchedule', StylistScheduleSchema);
