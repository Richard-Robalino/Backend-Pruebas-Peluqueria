import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  lastActivityAt: Date;
  revoked: boolean;
}

const SessionSchema = new Schema<ISession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lastActivityAt: { type: Date, default: () => new Date() },
  revoked: { type: Boolean, default: false }
}, { timestamps: true });

export const SessionModel: Model<ISession> = mongoose.model<ISession>('Session', SessionSchema);
