/**
 * Valida que la solicitud incluya la API_KEY correcta.
 * La API_KEY se configura como variable de entorno en Vercel.
 */
function validateApiKey(req) {
  const key = req.headers["x-api-key"];
  if (!key) return false;
  if (!process.env.API_KEY) {
    console.error("API_KEY no está configurada en las variables de entorno de Vercel.");
    return false;
  }
  return key === process.env.API_KEY;
}

/**
 * Agrega cabeceras CORS y de seguridad a la respuesta.
 * Solo acepta solicitudes desde Electron (no un origen HTTP externo).
 */
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

module.exports = { validateApiKey, setCorsHeaders };
