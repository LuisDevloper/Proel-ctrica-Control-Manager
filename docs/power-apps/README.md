# Plantilla Dataverse — Proélectrica Control Manager

Archivos generados para crear las tablas de **Canvas App + Dataverse**.

## Archivos

| Archivo | Uso |
|---------|-----|
| `Proelectrica-Dataverse-Plantilla.xlsx` | Importar tablas desde Excel en Power Apps |
| `dataverse-schema.json` | Referencia de columnas, choices y relaciones |
| **`GUIA-COMPLETA.md`** | **Todo lo que falta tras el Excel** (tipos, choices, lookups, Canvas) en un solo documento |

Regenerar tras cambios en el modelo:

```bash
npm run dataverse:template
```

## Importación en Power Apps

1. Entra a [make.powerapps.com](https://make.powerapps.com).
2. Crea un **entorno** y una **solución** (prefijo `pcm`).
3. **Tablas** → **Crear con archivo .CSV o de Excel** → sube `Proelectrica-Dataverse-Plantilla.xlsx`.
4. Deja **Incluir = ON** solo en estas **6 hojas**:
   - Tecnicos
   - Motores
   - Turbinas
   - Mantenimientos
   - Fallas
   - EnviosTaller
5. Apaga (**Incluir = OFF**): Instrucciones, Relaciones, todas las hojas `Choice_*`, **Repuestos** y **MovimientosInventario** (no se usan).
6. En cada tabla, activa **Primera fila como encabezados**. Deberías ver nombres como *Nombre completo*, *Codigo*, etc. (no "Nueva columna").
7. Ajusta tipos de columna según `dataverse-schema.json` (Fecha, Moneda, Numero, etc.).
8. Renombra columnas al nombre lógico `pcm_*` si hace falta (ver `dataverse-schema.json`).
9. Crea **Choice** (opciones) usando las hojas `Choice_*` como lista de valores.
10. Convierte columnas `Lookup texto` en relaciones **Lookup** (ver hoja **Relaciones**).
11. Crea la **Canvas App** y conecta las tablas `pcm_*`.

## Módulos incluidos / excluidos

| Módulo | Incluido |
|--------|----------|
| Motores, Turbinas, Técnicos | Sí |
| Mantenimientos, Fallas | Sí |
| Taller externo (envíos) | Sí |
| Inventario / Repuestos | **No** |

El campo `pcm_repuestos` en **Mantenimientos** sigue como texto libre (repuestos usados en ese servicio), sin tabla de inventario.

## Notas

- Los nombres lógicos usan prefijo `pcm_` (Proélectrica Control Manager).
- No incluye tabla de usuarios ni roles (acceso vía Microsoft 365).
- Documentos adjuntos: usar columna **File** en Dataverse o biblioteca SharePoint vinculada.
