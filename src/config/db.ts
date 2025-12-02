import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connect() {
  await mongoose.connect(env.MONGO_URI);
  console.log('MongoDB connected');
}
