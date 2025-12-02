// scripts/create-admin.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/lina_salon';

const userSchema = new mongoose.Schema(
  {
    nombre: String,
    apellido: String,
    email: { type: String, unique: true },
    cedula: String,
    telefono: String,
    password: String,
    role: { type: String, enum: ['ADMIN', 'GERENTE', 'ESTILISTA', 'CLIENTE'], default: 'CLIENTE' },
    emailVerified: { type: Boolean, default: false }
  },
  { collection: 'users', timestamps: true }
);

const User = mongoose.model('User', userSchema);

try {
  await mongoose.connect(MONGO, {});
  const exists = await User.findOne({ role: 'ADMIN' }).lean();
  if (exists) {
    console.log('Ya existe un administrador:', exists.email);
    process.exit(0);
  }

  const plain = 'Admin!1234'; // cámbiala antes/justo después
  const hash = await bcrypt.hash(plain, 10);

  const admin = await User.create({
    nombre: 'Admin',
    apellido: 'Root',
    email: 'admin@peluqueria.com',
    cedula: '0000000000',
    telefono: '0000000000',
    password: hash,
    role: 'ADMIN',
    emailVerified: true
  });

  console.log('Admin creado ✅');
  console.log('ID:', admin._id.toString());
  console.log('Email:', admin.email);
  console.log('Password temporal:', plain);
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('Error creando admin:', err);
  process.exit(1);
}
