import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPasswordResetToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  lastSentAt?: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  lastSentAt: Date
}, { timestamps: true });

export const PasswordResetTokenModel: Model<IPasswordResetToken> = mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);
