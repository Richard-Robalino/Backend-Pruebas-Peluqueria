import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'EMAIL'|'SYSTEM';
  title: string;
  message: string;
  sentAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['EMAIL','SYSTEM'], default: 'EMAIL' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: () => new Date() }
}, { timestamps: true });

export const NotificationModel: Model<INotification> = mongoose.model<INotification>('Notification', NotificationSchema);
