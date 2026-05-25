# Modulos de negocio

Logica de dominio extraida de los handlers IPC:

- `equipment/` — constantes y canonicalizacion de estados/ubicaciones
- `shipments/` — envios a taller externo y sincronizacion de ubicacion
- `import/` — parseo e importacion desde Excel
- `inventory/` — movimientos de inventario

Los handlers IPC viven en `src/main/ipc/handlers/` y delegan en estos modulos.
