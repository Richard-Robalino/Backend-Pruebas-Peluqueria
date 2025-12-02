import mongoose, { Schema, Types } from 'mongoose'

export interface ICategory {
  nombre: string
  descripcion?: string
  activo: boolean
  services: Types.ObjectId[]
}

const CategorySchema = new Schema<ICategory>({
  nombre: { type: String, required: true, trim: true, unique: true },
  descripcion: { type: String, trim: true },
  activo: { type: Boolean, default: true },
  services: [{ type: Schema.Types.ObjectId, ref: 'Service', default: [] }]
}, { timestamps: true })

export const CategoryModel = mongoose.model<ICategory>('Category', CategorySchema)
