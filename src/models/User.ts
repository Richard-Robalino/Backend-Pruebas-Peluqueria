import mongoose, { Schema, Document, Model } from 'mongoose';
import { ROLES, Role } from '../constants/roles.js';

export interface IUser extends Document {
  role: Role;
  nombre: string;
  apellido: string;
  cedula: string;
  telefono?: string;
  genero?: 'M' | 'F' | 'O';
  email: string;
  password?: string;
  provider: 'local' | 'google';
  googleId?: string;
  emailVerified: boolean;
  isActive: boolean;
  loginAttempts: number;
  lockUntil?: Date | null;
  lastLoginAt?: Date;
  frozenUntil?: Date | null;

  // 🔥 campos de relaciones
  servicesOffered: mongoose.Types.ObjectId[];
  catalogs: mongoose.Types.ObjectId[];
}

const UserSchema = new Schema<IUser>({
  role: { type: String, enum: Object.values(ROLES), required: true },
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  cedula: { type: String, required: true, unique: true },
  telefono: String,
  genero: { type: String, enum: ['M', 'F', 'O'] },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String },
  provider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleId: { type: String },
  emailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  lastLoginAt: Date,
  frozenUntil: { type: Date, default: null },

  // 🟢 servicios que ofrece el estilista (se rellenan desde los catálogos)
  servicesOffered: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      default: []
    }
  ],

  // 🟢 catálogos asignados al estilista
  catalogs: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: []
    }
  ]
}, { timestamps: true });

export const UserModel: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
