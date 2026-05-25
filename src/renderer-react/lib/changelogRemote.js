const MANIFEST_URL =
  "https://raw.githubusercontent.com/LuisDevloper/Proel-ctrica-Control-Manager/main/changelog-manifest.json";

let manifestPromise = null;

function normalizeVersion(version) {
  return String(version || "").replace(/^v/i, "").trim();
}

async function loadManifestEntries() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.entries) ? data.entries : [];
      })
      .catch(() => []);
  }
  return manifestPromise;
}

/** Busca notas de una version en el manifest publicado en GitHub. */
export async function fetchRemoteChangelogEntry(version) {
  const normalized = normalizeVersion(version);
  if (!normalized) return null;
  const entries = await loadManifestEntries();
  return entries.find((entry) => normalizeVersion(entry.version) === normalized) || null;
}
