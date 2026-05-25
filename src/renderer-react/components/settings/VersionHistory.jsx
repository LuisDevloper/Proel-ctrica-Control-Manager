import React, { useEffect, useState } from "react";
import { Badge } from "../ui/Badge";
import { getChangelogEntry, getChangelogSorted, formatReleaseDate, isVersionNewer } from "../../data/changelog";
import { fetchRemoteChangelogEntry } from "../../lib/changelogRemote";

const RELEASES_URL = "https://github.com/LuisDevloper/Proel-ctrica-Control-Manager/releases";

export function VersionHistory({ currentVersion, highlightVersion, onlyVersion, compact = false }) {
  const normalizedOnly = onlyVersion ? String(onlyVersion).replace(/^v/i, "") : null;
  let entries = getChangelogSorted();
  if (normalizedOnly) {
    entries = entries.filter((entry) => entry.version === normalizedOnly);
  }

  if (entries.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No hay historial de versiones disponible.</p>;
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? "" : "max-h-[420px] overflow-y-auto pr-1"}`}>
      {entries.map((entry) => {
        const isCurrent = currentVersion && entry.version === String(currentVersion).replace(/^v/i, "");
        const isHighlighted = highlightVersion && entry.version === String(highlightVersion).replace(/^v/i, "");
        const isFuture = currentVersion && isVersionNewer(entry.version, currentVersion);

        return (
          <article
            key={entry.version}
            className={`rounded-xl border p-3 ${
              isHighlighted
                ? "border-[#2f8dff]/50 bg-[#2f8dff]/8"
                : isCurrent
                  ? "border-[#29a16a]/40 bg-[#29a16a]/6"
                  : "border-[var(--border-soft)] bg-white/[0.02]"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">v{entry.version}</span>
              {entry.date ? (
                <span className="text-xs text-[var(--muted)]">{formatReleaseDate(entry.date)}</span>
              ) : null}
              {isCurrent && <Badge variant="success">Actual</Badge>}
              {isHighlighted && !isCurrent && <Badge variant="default">Nueva</Badge>}
              {isFuture && !isHighlighted && <Badge variant="default">Proxima</Badge>}
            </div>
            {entry.title ? (
              <p className="text-sm font-medium text-[var(--text)] mb-2">{entry.title}</p>
            ) : null}
            <ul className="list-disc list-inside flex flex-col gap-1 text-xs text-[var(--muted)] leading-relaxed">
              {(entry.highlights || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

function normalizeVersion(version) {
  return String(version || "").replace(/^v/i, "").trim();
}

function entryFromUpdaterNotes(version, data) {
  if (!data?.highlights?.length) return null;
  return {
    version: normalizeVersion(version),
    date: "",
    title: data.title || `Version ${normalizeVersion(version)}`,
    highlights: data.highlights,
  };
}

export function VersionReleaseNotes({ version, currentVersion }) {
  const normalized = normalizeVersion(version);
  const [entry, setEntry] = useState(() => getChangelogEntry(normalized));
  const [loading, setLoading] = useState(!entry);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const local = getChangelogEntry(normalized);
      if (local) {
        setEntry(local);
        setLoading(false);
        setFailed(false);
        return;
      }

      setLoading(true);
      setFailed(false);

      try {
        const updaterNotes = await window.proelectricaApi?.getUpdaterReleaseNotes?.(normalized);
        if (cancelled) return;
        const fromUpdater = entryFromUpdaterNotes(normalized, updaterNotes);
        if (fromUpdater) {
          setEntry(fromUpdater);
          setLoading(false);
          return;
        }

        const remote = await fetchRemoteChangelogEntry(normalized);
        if (cancelled) return;
        if (remote) {
          setEntry(remote);
          setLoading(false);
          return;
        }
      } catch {
        if (cancelled) return;
      }

      setEntry(null);
      setFailed(true);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [normalized]);

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Cargando novedades…</p>;
  }

  if (entry) {
    return (
      <VersionHistory
        currentVersion={currentVersion}
        highlightVersion={entry.version}
        onlyVersion={entry.version}
        compact
      />
    );
  }

  if (failed) {
    return (
      <p className="text-sm text-[var(--muted)] leading-relaxed">
        No se pudieron cargar las notas de la version {version} desde esta instalacion.
        {" "}
        <a
          href={`${RELEASES_URL}/tag/v${normalized}`}
          target="_blank"
          rel="noreferrer"
          className="text-[#7ab8ff] hover:underline"
        >
          Ver release en GitHub
        </a>
      </p>
    );
  }

  return null;
}
