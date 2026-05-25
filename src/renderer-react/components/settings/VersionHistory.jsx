import React from "react";
import { Badge } from "../ui/Badge";
import { getChangelogSorted, formatReleaseDate, isVersionNewer } from "../../data/changelog";

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
              <span className="text-xs text-[var(--muted)]">{formatReleaseDate(entry.date)}</span>
              {isCurrent && <Badge variant="success">Actual</Badge>}
              {isHighlighted && !isCurrent && <Badge variant="default">Nueva</Badge>}
              {isFuture && !isHighlighted && <Badge variant="default">Proxima</Badge>}
            </div>
            <p className="text-sm font-medium text-[var(--text)] mb-2">{entry.title}</p>
            <ul className="list-disc list-inside flex flex-col gap-1 text-xs text-[var(--muted)] leading-relaxed">
              {entry.highlights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

export function VersionReleaseNotes({ version, currentVersion }) {
  const normalized = String(version || "").replace(/^v/i, "");
  const entry = getChangelogSorted().find((e) => e.version === normalized);

  if (!entry) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No hay notas de la version {version} en esta instalacion. Consulte el release en GitHub.
      </p>
    );
  }

  return (
    <VersionHistory
      currentVersion={currentVersion}
      highlightVersion={entry.version}
      onlyVersion={entry.version}
      compact
    />
  );
}
