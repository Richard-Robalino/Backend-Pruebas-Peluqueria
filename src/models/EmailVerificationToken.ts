import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmailVerificationToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  lastSentAt?: Date;
}

const EmailVerificationTokenSchema = new Schema<IEmailVerificationToken>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  lastSentAt: Date
}, { timestamps: true });

export const EmailVerificationTokenModel: Model<IEmailVerificationToken> =
  mongoose.model<IEmailVerificationToken>('EmailVerificationToken', EmailVerificationTokenSchema);
