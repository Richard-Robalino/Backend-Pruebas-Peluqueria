import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { UserModel } from '../src/models/User.js';

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const result = await UserModel.updateMany(
    { provider: 'local', emailVerified: { $ne: true } },
    { $set: { emailVerified: true } }
  );
  console.log(`Marcados como verificados: ${result.modifiedCount}`);
  await mongoose.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
