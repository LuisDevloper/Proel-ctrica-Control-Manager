/**
 * Esquemas de validación Zod para todos los handlers IPC.
 *
 * Uso en un handler:
 *   const { validate, schemas } = require("../schemas");
 *   ...
 *   const invalid = validate(schemas.motorCreate, motor);
 *   if (invalid) return invalid;
 */

const { z } = require("zod");

// ── Primitivos reutilizables ────────────────────────────────────────────────

/** ID entero positivo (acepta string numérico del IPC) */
const zId = z.coerce.number({ invalid_type_error: "El ID debe ser un número." }).int().positive("El ID debe ser mayor a 0.");

/** Cadena requerida (no vacía tras trim) */
const zStr = z
  .string({ required_error: "Campo requerido.", invalid_type_error: "Se esperaba texto." })
  .min(1, "No puede estar vacío.");

/** Cadena opcional — null / undefined / "" todos aceptados */
const zOptStr = z.string().optional().nullable();

/** Fecha como cadena YYYY-MM-DD (o ISO), requerida */
const zDate = z
  .string({ required_error: "La fecha es requerida." })
  .min(1, "La fecha no puede estar vacía.")
  .regex(/^\d{4}-\d{2}-\d{2}/, "Formato de fecha inválido (YYYY-MM-DD).");

/** Fecha opcional */
const zOptDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Formato de fecha inválido (YYYY-MM-DD).")
  .optional()
  .nullable();

/** Número no negativo (stock, costo, cantidad) */
const zNonNeg = z.coerce.number().min(0, "No puede ser negativo.");

/** Número positivo (cantidad de movimiento) */
const zPositive = z.coerce.number().positive("La cantidad debe ser mayor a 0.");

// ── auth ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: zStr.max(100, "Usuario demasiado largo."),
  password: zStr,
}).passthrough();

const changePasswordSchema = z.object({
  userId: zId,
  currentPassword: zStr,
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres."),
}).passthrough();

// ── motors ──────────────────────────────────────────────────────────────────

const motorCreateSchema = z.object({
  code:  zStr.max(100, "El código es demasiado largo."),
  brand: zStr.max(150, "La marca es demasiado larga."),
  model:          zOptStr,
  serial_number:  zOptStr,
  voltage:        zOptStr,
  power:          zOptStr,
  rpm:            zOptStr,
  location:       zOptStr,
  operationalLocation:  zOptStr,
  operational_location: zOptStr,
  status:         zOptStr,
  installed_at:   zOptDate,
  notes:          zOptStr,
  photo:          zOptStr,
  _username:      zOptStr,
}).passthrough();

const motorUpdateSchema = motorCreateSchema.extend({ id: zId });

// ── turbinas ─────────────────────────────────────────────────────────────────

const turbinaCreateSchema = z.object({
  code: zStr.max(100, "El código es demasiado largo."),
  serialNumber:  zOptStr, serial_number: zOptStr,
  gg: zOptStr, pt: zOptStr,
  bearing1: zOptStr, bearing_1: zOptStr,
  bearing2: zOptStr, bearing_2: zOptStr,
  runtimeRetiro: zOptStr, runtime_retiro: zOptStr,
  comentariosRetiro: zOptStr, comentarios_retiro: zOptStr,
  operationalLocation: zOptStr, operational_location: zOptStr,
  status: zOptStr,
  motorId: z.coerce.number().int().positive().optional().nullable(),
  motor_id: z.coerce.number().int().positive().optional().nullable(),
  notes: zOptStr,
  _username: zOptStr,
}).passthrough();

const turbinaUpdateSchema = turbinaCreateSchema.extend({ id: zId });

// ── maintenances ────────────────────────────────────────────────────────────

const maintenanceCreateSchema = z.object({
  motorId: zId,
  technicianId: z.coerce.number().int().positive().optional().nullable(),
  maintenanceType: zStr.max(100, "Tipo demasiado largo."),
  maintenanceDate: zDate,
  description: zOptStr,
  partsUsed:   zOptStr,
  cost: zNonNeg.optional(),
  status: zOptStr,
  notes: zOptStr,
  _username: zOptStr,
}).passthrough();

const maintenanceUpdateSchema = maintenanceCreateSchema.extend({ id: zId });

const calendarParamsSchema = z.object({
  year:  z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
}).passthrough();

// ── failures ─────────────────────────────────────────────────────────────────

const failureCreateSchema = z.object({
  motorId: zId,
  technicianId: z.coerce.number().int().positive().optional().nullable(),
  failureType: zStr.max(150, "Tipo de falla demasiado largo."),
  priority:    zStr.max(50, "Prioridad demasiado larga."),
  status:      zStr.max(50, "Estado demasiado largo."),
  reportedAt:  zDate,
  solution: zOptStr,
  notes:    zOptStr,
  _username: zOptStr,
}).passthrough();

const failureUpdateSchema = failureCreateSchema.extend({ id: zId });

// ── technicians ──────────────────────────────────────────────────────────────

const technicianCreateSchema = z.object({
  fullName:  zStr.max(200, "Nombre demasiado largo."),
  phone:     zOptStr,
  email:     z.string().email("Email inválido.").optional().nullable().or(z.literal("")),
  specialty: zOptStr,
  _username: zOptStr,
}).passthrough();

const technicianUpdateSchema = technicianCreateSchema.extend({ id: zId });

// ── inventory ────────────────────────────────────────────────────────────────

const inventoryCreateSchema = z.object({
  partName:  zStr.max(200, "Nombre demasiado largo."),
  sku:       zOptStr,
  quantity:  zNonNeg.optional(),
  minStock:  zNonNeg.optional(),
  location:  zOptStr,
  _username: zOptStr,
}).passthrough();

const inventoryUpdateSchema = inventoryCreateSchema.extend({ id: zId });

const inventoryMovementsListSchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  limit:  z.coerce.number().int().min(1).max(500).optional(),
}).passthrough();

const inventoryMovementCreateSchema = z.object({
  inventoryItemId:  zId.optional(),
  inventory_item_id: zId.optional(),
  movementType:   z.enum(["entrada", "salida", "ajuste"]).optional(),
  movement_type:  z.enum(["entrada", "salida", "ajuste"]).optional(),
  quantity: zPositive,
  referenceType:  zOptStr, reference_type: zOptStr,
  referenceId:    z.coerce.number().int().positive().optional().nullable(),
  reference_id:   z.coerce.number().int().positive().optional().nullable(),
  referenceLabel: zOptStr, reference_label: zOptStr,
  notes:     zOptStr,
  _username: zOptStr,
}).passthrough().superRefine((data, ctx) => {
  const itemId = data.inventoryItemId ?? data.inventory_item_id;
  if (!itemId) {
    ctx.addIssue({ code: "custom", message: "Se requiere inventoryItemId.", path: ["inventoryItemId"] });
  }
});

// ── shipments ────────────────────────────────────────────────────────────────

const shipmentCreateSchema = z.object({
  equipmentType:  z.enum(["motor", "turbine"], { errorMap: () => ({ message: 'El tipo de equipo debe ser "motor" o "turbine".' }) }).optional(),
  equipment_type: z.enum(["motor", "turbine"]).optional(),
  equipmentId:    z.coerce.number().int().positive().optional(),
  equipment_id:   z.coerce.number().int().positive().optional(),
  workshopName:   zOptStr,
  workshop_name:  zOptStr,
  departureDate:  zOptDate,
  departure_date: zOptDate,
  responsible:    zOptStr,
  expectedReturnDate: zOptDate, expected_return_date: zOptDate,
  actualReturnDate:   zOptDate, actual_return_date:   zOptDate,
  motive:             zOptStr,
  equipmentCondition: zOptStr, equipment_condition: zOptStr,
  logisticsStatus:    zOptStr, logistics_status:    zOptStr,
  notes:    zOptStr,
  _username: zOptStr,
}).passthrough().superRefine((data, ctx) => {
  const type = data.equipmentType ?? data.equipment_type;
  if (!type) {
    ctx.addIssue({ code: "custom", message: "Se requiere el tipo de equipo.", path: ["equipmentType"] });
  }
  const equipId = data.equipmentId ?? data.equipment_id;
  if (!equipId) {
    ctx.addIssue({ code: "custom", message: "Se requiere el ID del equipo.", path: ["equipmentId"] });
  }
  const workshop = data.workshopName ?? data.workshop_name;
  if (!workshop || String(workshop).trim() === "") {
    ctx.addIssue({ code: "custom", message: "El nombre del taller es requerido.", path: ["workshopName"] });
  }
  const departure = data.departureDate ?? data.departure_date;
  if (!departure) {
    ctx.addIssue({ code: "custom", message: "La fecha de salida es requerida.", path: ["departureDate"] });
  }
});

const shipmentUpdateSchema = shipmentCreateSchema.extend({ id: zId }).superRefine(() => {});

// ── users ────────────────────────────────────────────────────────────────────

const VALID_ROLES = ["ADMIN", "OPERADOR", "VISOR"];

const userCreateSchema = z.object({
  username: zStr.max(100, "Usuario demasiado largo."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  role: z.enum(["ADMIN", "OPERADOR", "VISOR"]).optional(),
}).passthrough();

const userUpdateRoleSchema = z.object({
  id:   zId,
  role: z.enum(["ADMIN", "OPERADOR", "VISOR"], { error: `El rol debe ser uno de: ${VALID_ROLES.join(", ")}.` }),
}).passthrough();

const userResetPasswordSchema = z.object({
  id:       zId,
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
}).passthrough();

// ── Helper ──────────────────────────────────────────────────────────────────

/**
 * Valida `data` contra `schema`.
 * @returns {null} si es válido, o `{ ok: false, message: string }` si no.
 */
function validate(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return null;

  // Zod v4 usa .issues; Zod v3 usa .errors (ambos son arrays de ZodIssue)
  const issues = result.error.issues ?? result.error.errors ?? [];
  const msg = issues
    .map((e) => e.message)
    .filter(Boolean)
    .join("; ");

  return { ok: false, message: `Datos inválidos: ${msg}` };
}

/**
 * Valida un ID directo (no dentro de objeto).
 * @returns {null} si es válido, o `{ ok: false, message: string }`.
 */
function validateId(id) {
  return validate(z.object({ id: zId }), { id });
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  validate,
  validateId,
  schemas: {
    // auth
    loginSchema,
    changePasswordSchema,
    // motors
    motorCreateSchema,
    motorUpdateSchema,
    // turbinas
    turbinaCreateSchema,
    turbinaUpdateSchema,
    // maintenances
    maintenanceCreateSchema,
    maintenanceUpdateSchema,
    calendarParamsSchema,
    // failures
    failureCreateSchema,
    failureUpdateSchema,
    // technicians
    technicianCreateSchema,
    technicianUpdateSchema,
    // inventory
    inventoryCreateSchema,
    inventoryUpdateSchema,
    inventoryMovementsListSchema,
    inventoryMovementCreateSchema,
    // shipments
    shipmentCreateSchema,
    shipmentUpdateSchema,
    // users
    userCreateSchema,
    userUpdateRoleSchema,
    userResetPasswordSchema,
  },
};
