import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBusinessHours extends Document {
  days: { dayOfWeek: number; open: string; close: string }[]; // HH:mm
  exceptions: { date: string; closed?: boolean; open?: string; close?: string }[]; // date: YYYY-MM-DD
}

const BusinessHoursSchema = new Schema<IBusinessHours>({
  days: [{
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    open: { type: String, required: true },
    close: { type: String, required: true }
  }],
  exceptions: [{
    date: { type: String, required: true },
    closed: Boolean,
    open: String,
    close: String
  }]
}, { timestamps: true });

export const BusinessHoursModel: Model<IBusinessHours> = mongoose.model<IBusinessHours>('BusinessHours', BusinessHoursSchema);
