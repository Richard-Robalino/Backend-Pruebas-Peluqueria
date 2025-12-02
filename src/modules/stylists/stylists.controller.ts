import { Request, Response, NextFunction } from 'express'
import { UserModel } from '../../models/User.js'
import { ServiceModel } from '../../models/Service.js'
import { CategoryModel } from '../../models/Category.js' // 🆕 usamos Category (catálogo)
import { ROLES } from '../../constants/roles.js'
import { StatusCodes } from 'http-status-codes'
import { ApiError } from '../../middlewares/errorHandler.js'
import { hashPassword } from '../../utils/password.js'
import mongoose from 'mongoose'

/**
 * Helper: valida catálogos y devuelve:
 * - catalogObjectIds: array de ObjectId de Category
 * - serviceObjectIds: array de ObjectId de Service (de todos los catálogos)
 */
async function resolveCatalogsAndServices(rawCatalogs: string[]) {
  const uniqueCatalogs = Array.from(new Set(rawCatalogs || []))

  if (!uniqueCatalogs.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Debes enviar al menos un catálogo'
    )
  }

  // Validar que sean ObjectId válidos
  const invalid = uniqueCatalogs.filter(id => !mongoose.isValidObjectId(id))
  if (invalid.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `IDs de catálogo inválidos: ${invalid.join(', ')}`
    )
  }

  // Buscar catálogos activos
  const catalogs = await CategoryModel.find({
    _id: { $in: uniqueCatalogs },
    activo: true
  })
    .select('_id services nombre activo')
    .lean()

  if (catalogs.length !== uniqueCatalogs.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Uno o más catálogos no existen o están inactivos'
    )
  }

  // Extraer todos los servicios de esos catálogos
  const serviceIdSet = new Set<string>()
  for (const c of catalogs) {
    for (const s of (c as any).services || []) {
      serviceIdSet.add(String(s))
    }
  }

  const allServiceIds = Array.from(serviceIdSet)

  if (!allServiceIds.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Los catálogos seleccionados no tienen servicios asociados'
    )
  }

  // Validar que todos esos servicios existan y estén activos
  const count = await ServiceModel.countDocuments({
    _id: { $in: allServiceIds },
    activo: true
  })

  if (count !== allServiceIds.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Uno o más servicios de los catálogos no existen o están inactivos'
    )
  }

  return {
    catalogObjectIds: uniqueCatalogs.map(id => new mongoose.Types.ObjectId(id)),
    serviceObjectIds: allServiceIds.map(id => new mongoose.Types.ObjectId(id))
  }
}

/**
 * Lista estilistas activos
 * (se mantiene como lo tenías, solo agrego populate opcional de catálogos)
 */
export async function listStylists(_req: Request, res: Response, next: NextFunction) {
  try {
    const stylists = await UserModel
      .find({ role: ROLES.ESTILISTA, isActive: true })
      .select('-password')
      .populate('servicesOffered', 'nombre duracionMin precio activo')
      .populate('catalogs', 'nombre descripcion activo') // requiere que User tenga ref a Category
    res.json(stylists)
  } catch (err) { next(err as any) }
}

/**
 * 🆕 GET /api/v1/stylists/:id/catalogs
 * Ver catálogos que tiene un estilista
 */
export async function listStylistCatalogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'ID de estilista inválido')
    }

    const stylist = await UserModel.findOne({
      _id: id,
      role: ROLES.ESTILISTA,
      isActive: true
    })
      .select('nombre apellido catalogs')
      .populate({
        path: 'catalogs',
        match: { activo: true },
        populate: {
          path: 'services',
          select: 'nombre duracionMin precio activo'
        }
      })

    if (!stylist) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Estilista no encontrado')
    }

    res.json({
      stylist: {
        id: stylist.id,
        nombre: stylist.nombre,
        apellido: stylist.apellido
      },
      catalogs: (stylist as any).catalogs || []
    })
  } catch (err) {
    next(err as any)
  }
}

/**
 * 🆕 GET /api/v1/stylists/:id/catalogs/:catalogId/services
 * Ver servicios de un catálogo asignado a ese estilista
 */
export async function listStylistCatalogServices(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, catalogId } = req.params

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(catalogId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'IDs inválidos')
    }

    const stylist = await UserModel.findOne({
      _id: id,
      role: ROLES.ESTILISTA,
      isActive: true
    })
      .select('catalogs nombre apellido')
      .lean()

    if (!stylist) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Estilista no encontrado')
    }

    const catalogIds = Array.isArray((stylist as any).catalogs)
      ? (stylist as any).catalogs.map((c: any) => String(c))
      : []

    if (!catalogIds.includes(String(catalogId))) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Ese catálogo no está asignado al estilista'
      )
    }

    const catalog = await CategoryModel.findOne({
      _id: catalogId,
      activo: true
    })
      .populate('services', 'nombre duracionMin precio activo')

    if (!catalog) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Catálogo no encontrado o inactivo')
    }

    res.json({
      stylist: {
        id: id,
        nombre: (stylist as any).nombre,
        apellido: (stylist as any).apellido
      },
      catalog: {
        id: catalog.id,
        nombre: catalog.nombre,
        descripcion: (catalog as any).descripcion,
        services: (catalog as any).services
      }
    })
  } catch (err) {
    next(err as any)
  }
}

/**
 * Crear estilista (ADMIN/GERENTE)
 * 👉 Ahora recibe "catalogs" (IDs de Category) en lugar de "servicesOffered"
 */
export async function createStylist(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      nombre,
      apellido,
      cedula,
      telefono,
      genero,
      edad,
      email,
      password,
      catalogs
    } = req.body as {
      nombre: string
      apellido: string
      cedula: string
      telefono?: string
      genero?: string
      edad?: number
      email: string
      password: string
      catalogs: string[]
    }

    const exists = await UserModel.exists({ email })
    if (exists) throw new ApiError(StatusCodes.CONFLICT, 'Email ya registrado')

    const cedExists = await UserModel.exists({ cedula })
    if (cedExists) throw new ApiError(StatusCodes.CONFLICT, 'Cédula ya registrada')

    // 🔍 Validar catálogos y obtener servicios de esos catálogos
    const { catalogObjectIds, serviceObjectIds } = await resolveCatalogsAndServices(catalogs)

    const stylist = await UserModel.create({
      role: ROLES.ESTILISTA,
      nombre,
      apellido,
      cedula,
      telefono,
      genero,
      edad,
      email,
      password: await hashPassword(password),
      provider: 'local',
      emailVerified: false,
      isActive: true,
      catalogs: catalogObjectIds,         // 🔥 catálogos asignados
      servicesOffered: serviceObjectIds   // 🔥 resumen de servicios de esos catálogos
    })

    res.status(StatusCodes.CREATED).json({
      id: stylist.id,
      message: 'Estilista creado con catálogos. Usa /api/v1/auth/send-verification-email para enviar verificación cuando quieras.'
    })
  } catch (err) { next(err as any) }
}

/**
 * Actualizar catálogos de un estilista
 * (y recalcular servicesOffered a partir de esos catálogos)
 *
 * - ADMIN/GERENTE: cualquier estilista
 * - ESTILISTA: solo su propio ID
 *
 * 👉 Reutilizamos la ruta PUT /:id/services
 *    pero ahora el body lleva { catalogs: [...] }
 */
export async function updateStylistServices(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const { catalogs } = req.body as { catalogs: string[] }

    // Si es estilista, solo puede actualizarse a sí mismo
    if (req.user?.role === ROLES.ESTILISTA && req.user.id !== id) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado')
    }

    // Validar catálogos y servicios relacionados
    const { catalogObjectIds, serviceObjectIds } = await resolveCatalogsAndServices(catalogs)

    const updated = await UserModel.findOneAndUpdate(
      { _id: id, role: ROLES.ESTILISTA },
      {
        $set: {
          catalogs: catalogObjectIds,
          servicesOffered: serviceObjectIds
        }
      },
      { new: true }
    )
      .select('-password')
      .populate('catalogs', 'nombre descripcion activo')
      .populate('servicesOffered', 'nombre duracionMin precio activo')

    if (!updated) throw new ApiError(StatusCodes.NOT_FOUND, 'Estilista no encontrado')

    res.json(updated)
  } catch (err) { next(err as any) }
}
