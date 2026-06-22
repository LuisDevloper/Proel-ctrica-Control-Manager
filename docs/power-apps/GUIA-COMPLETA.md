# Guía completa — Dataverse + Canvas (todo en un solo lugar)

> **Por qué no hay un solo archivo “100 % listo”**  
> Microsoft Power Apps **solo importa tablas básicas desde Excel** (columnas como texto).  
> **No** importa en un paso: tipos Fecha/Moneda, Choice, Lookup, relaciones ni Canvas App.  
> Eso es límite de la plataforma, no del Excel.  
>  
> Lo más cercano a “todo hecho” es esta guía + `Proelectrica-Dataverse-Plantilla.xlsx` + `dataverse-schema.json`.

---

## Archivos del proyecto

| Archivo | Qué hace |
|---------|----------|
| `Proelectrica-Dataverse-Plantilla.xlsx` | Crea las **6 tablas** (ya usaste este paso) |
| `dataverse-schema.json` | Referencia técnica columnas / choices / relaciones |
| Este archivo | **Todo lo que falta**, paso a paso, sin saltar entre docs |

Regenerar Excel/JSON:

```bash
npm run dataverse:template
```

---

## 1. Tablas creadas (checklist)

Marca cuando existan en **Tablas**:

- [ ] Technician (Técnicos)
- [ ] Motor / Engine (Motores)
- [ ] Turbine (Turbinas)
- [ ] Maintenance Task (Mantenimientos)
- [ ] Failure / Falla (Fallas)
- [ ] Envío taller externo (EnviosTaller)

Borrar filas de ejemplo si se importaron (Juan Pérez, MOT-001, etc.).

---

## 2. Tipos de columna (tabla por tabla)

### Technician

| Columna | Tipo Dataverse | Obligatorio |
|---------|----------------|-------------|
| Nombre completo | Texto | Sí — columna principal |
| Telefono | Texto | No |
| Correo | Correo electrónico | No |
| Especialidad | Texto | No |

### Motor

| Columna | Tipo Dataverse | Obligatorio |
|---------|----------------|-------------|
| Codigo | Texto | Sí — columna principal |
| Marca | Texto | Sí |
| Modelo | Texto | No |
| Numero de serie | Texto | No |
| Voltaje (V) | Número entero | No |
| Potencia (kW) | Número decimal | No |
| RPM | Número entero | No |
| Detalle ubicacion | Texto | No |
| Ubicacion operativa | **Elección** → `ubicacion_operativa` | No |
| Estado | **Elección** → `estado_equipo` | No |
| Fecha instalacion | Solo fecha | No |
| Notas | Texto multilínea | No |

### Turbina

| Columna | Tipo Dataverse | Obligatorio |
|---------|----------------|-------------|
| Codigo | Texto | Sí — columna principal |
| GG | Texto | No |
| PT | Texto | No |
| Rodamiento 1 | Texto | No |
| Rodamiento 2 | Texto | No |
| Runtime retiro | Texto | No |
| Comentarios retiro | Texto multilínea | No |
| Ubicacion operativa | **Elección** → `ubicacion_operativa` | No |
| Estado | **Elección** → `estado_equipo` | No |
| Motor vinculado (codigo) | Texto → luego **Lookup** a Motor | No |
| Notas | Texto multilínea | No |

### Maintenance Task (Mantenimientos)

| Columna | Tipo Dataverse | Obligatorio |
|---------|----------------|-------------|
| Motor (codigo) | Texto → luego **Lookup** a Motor | Sí |
| Tecnico (nombre) | Texto → luego **Lookup** a Technician | No |
| Tipo | **Elección** → `tipo_mantenimiento` | No |
| Fecha | Solo fecha | Sí |
| Descripcion | Texto multilínea | No |
| Repuestos usados | Texto multilínea | No |
| Costo | Moneda | No |
| Estado | **Elección** → `estado_mantenimiento` | No |
| Notas | Texto multilínea | No |

> **Repuestos usados** = texto libre en el mantenimiento. **No** hay tabla de inventario.

### Falla

| Columna | Tipo Dataverse | Obligatorio |
|---------|----------------|-------------|
| Motor (codigo) | Texto → luego **Lookup** a Motor | Sí |
| Tecnico (nombre) | Texto → luego **Lookup** a Technician | No |
| Tipo de falla | Texto | Sí — columna principal |
| Prioridad | **Elección** → `prioridad_falla` | No |
| Estado | **Elección** → `estado_falla` | No |
| Fecha reporte | Solo fecha | Sí |
| Solucion | Texto multilínea | No |
| Notas | Texto multilínea | No |

### Envío taller externo

| Columna | Tipo Dataverse | Obligatorio |
|---------|----------------|-------------|
| Tipo equipo | **Elección** → `tipo_equipo_envio` | No |
| Codigo equipo | Texto | Sí |
| Taller externo | Texto | Sí — columna principal |
| Responsable | Texto | No |
| Fecha salida | Solo fecha | Sí |
| Retorno estimado | Solo fecha | No |
| Retorno real | Solo fecha | No |
| Motivo | Texto multilínea | No |
| Estado fisico equipo | Texto | No |
| Estado logistica | **Elección** → `estado_logistica` | No |
| Notas | Texto multilínea | No |

---

## 3. Choice — copiar y pegar valores

En Power Apps: **Opciones** → **Nueva elección** → nombre en inglés sin espacios (o con prefijo `pcm`).

### estado_equipo

```
Operativo
En mantenimiento
En almacen
Fuera de servicio
```

### ubicacion_operativa

```
En planta
Afuera
Taller externo
Almacen
En mantenimiento
```

### estado_mantenimiento

```
Pendiente
En progreso
Completado
```

### tipo_mantenimiento

```
Preventivo
Correctivo
```

### prioridad_falla

```
Alta
Media
Baja
```

### estado_falla

```
Pendiente
En proceso
Resuelta
```

### tipo_equipo_envio

```
Motor
Turbina
```

### estado_logistica

```
Permiso de salida aprobado
Equipo en transito
Entrada registrada
Equipo entregado
```

*(Opcional futuro: tipo_documento — Cotizacion, Informe tecnico, Orden de trabajo, Otro)*

---

## 4. Relaciones Lookup

**Orden:** crea primero Motor y Technician, luego el resto.

| Tabla origen | Columna (texto actual) | Tabla destino | Columna destino |
|--------------|------------------------|---------------|-----------------|
| Turbina | Motor vinculado (codigo) | Motor | Codigo |
| Maintenance Task | Motor (codigo) | Motor | Codigo |
| Maintenance Task | Tecnico (nombre) | Technician | Nombre completo |
| Falla | Motor (codigo) | Motor | Codigo |
| Falla | Tecnico (nombre) | Technician | Nombre completo |

**Cómo en Dataverse**

1. Tabla origen → **Relaciones** → **Nueva relación**.
2. Tipo: **Muchos a uno** (N:1).
3. Tabla relacionada: destino (Motor o Technician).
4. Nombre sugerido lookup: `pcm_Motor`, `pcm_Tecnico`.
5. Guardar → **Publicar**.
6. Cuando el lookup funcione, **elimina** la columna de texto antigua (Motor codigo / Tecnico nombre).

**Envío taller — Codigo equipo:** dejar como texto (puede ser MOT-xxx o TUR-xxx). Lookup condicional se hace después en Canvas con filtros.

---

## 5. Solución

1. **Soluciones** → **Nueva solución**.
2. Nombre: `Proelectrica Control Manager`.
3. Publicador con prefijo **`pcm`**.
4. **Agregar existente** → **Tabla** → las 6 tablas + sus choices.
5. **Publicar personalizaciones**.

---

## 6. Canvas App (estructura sugerida)

**Crear** → **Aplicación de lienzo en blanco** → formato tableta/telefono → conectar Dataverse.

### Pantallas

| Pantalla | Contenido |
|----------|-----------|
| Inicio | Logo, botones: Motores, Turbinas, Mantenimientos, Fallas, Taller, Técnicos |
| Motores | Galería `Motors` + formulario nuevo/editar |
| Turbinas | Galería + formulario + combo Motor (lookup) |
| Mantenimientos | Galería + formulario + combos Motor/Técnico |
| Fallas | Galería + formulario + prioridad/estado (choice) |
| Taller | Galería envíos + fechas salida/retorno |
| Técnicos | Galería + formulario simple |

### Controles típicos

- **Galería:** `Items = Sort(Motors, Codigo)` (ajusta nombres según tu entorno).
- **Combo Motor:** `Items = Motors`, `DisplayFields = ["Codigo","Marca"]`.
- **Guardar:** `SubmitForm(FormMotor)` o `Patch(Motors, Defaults(Motors), FormMotor.Updates)`.

---

## 7. Lo que NO incluye esta migración

| Excluido | Motivo |
|----------|--------|
| Repuestos / Inventario | Decisión tuya |
| Usuarios y roles custom | Acceso vía Microsoft 365 |
| Adjuntos PDF | Columna File o SharePoint aparte |
| Dashboard con gráficos | Se construye en Canvas con controles Chart |
| App Electron completa clonada | Canvas se diseña pantalla a pantalla |

---

## 8. Alternativa “más automática” (avanzado)

Si tienes **Power Platform CLI** (`pac`) y permisos de administrador:

- Se puede empaquetar una **solución .zip** (unmanaged) con tablas/choices ya definidas.
- Requiere autenticación a tu tenant y `pac solution import`.
- No está en el repo porque depende de **tu** entorno Microsoft 365.

Si quieres ese camino, pide en el chat: *“generar solución pac CLI”*.

---

## Orden de trabajo hoy (resumen)

1. ✅ Tablas (Excel) — **hecho**
2. Tipos de columna (sección 2)
3. Choices (sección 3)
4. Lookups (sección 4)
5. Solución (sección 5)
6. Canvas App (sección 6)

Cuando termines el paso 3 o 4, continúa en el chat con captura y te guío el siguiente clic.
