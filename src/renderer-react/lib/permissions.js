/** Texto tooltip cuando el rol VISOR no puede modificar datos */
export const READ_ONLY_ROLE_TITLE = "Tu rol (Solo lectura) no permite crear ni modificar datos.";

/** ADMIN y OPERADOR pueden dar de alta / editar / borrar registros operativos */
export function canMutateRecords(role) {
  return role === "ADMIN" || role === "OPERADOR";
}
