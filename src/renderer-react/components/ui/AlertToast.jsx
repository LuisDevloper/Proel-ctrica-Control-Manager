import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    label: "Listo",
    accent: "var(--success)",
  },
  warning: {
    icon: AlertTriangle,
    label: "Atención",
    accent: "var(--warning)",
  },
  info: {
    icon: Info,
    label: "Información",
    accent: "var(--primary)",
  },
};

function parseAlertMessage(message, type) {
  const text = String(message || "").trim();
  const welcomeMatch = text.match(/^Bienvenido,\s*(.+)$/i);
  if (welcomeMatch && type === "success") {
    return { title: "Bienvenido", detail: welcomeMatch[1].trim() };
  }
  return { title: text, detail: null };
}

export function AlertToast({
  message,
  type = "info",
  duration = 3200,
  onDismiss,
  className,
}) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;
  const parsed = useMemo(() => parseAlertMessage(message, type), [message, type]);

  useEffect(() => {
    const enterId = window.requestAnimationFrame(() => setVisible(true));
    const leaveAt = Math.max(1200, duration - 280);
    const leaveTimer = window.setTimeout(() => setLeaving(true), leaveAt);
    const dismissTimer = window.setTimeout(() => onDismiss?.(), duration);
    return () => {
      window.cancelAnimationFrame(enterId);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  function dismissNow() {
    setLeaving(true);
    window.setTimeout(() => onDismiss?.(), 220);
  }

  return (
    <div
      className={cn(
        "pcm-alert",
        `pcm-alert--${type}`,
        visible && !leaving && "pcm-alert--visible",
        leaving && "pcm-alert--leaving",
        className
      )}
      role={type === "warning" ? "alert" : "status"}
      aria-live={type === "warning" ? "assertive" : "polite"}
    >
      <div className="pcm-alert__accent" aria-hidden />

      <div className="pcm-alert__icon" style={{ color: cfg.accent }}>
        <Icon size={18} strokeWidth={2.25} aria-hidden />
      </div>

      <div className="pcm-alert__body min-w-0">
        <p className="pcm-alert__label">{cfg.label}</p>
        <p className="pcm-alert__title truncate">{parsed.title}</p>
        {parsed.detail ? (
          <p className="pcm-alert__detail truncate">{parsed.detail}</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={dismissNow}
        className="pcm-alert__close"
        aria-label="Cerrar aviso"
      >
        <X size={14} aria-hidden />
      </button>

      <div className="pcm-alert__progress-wrap" aria-hidden>
        <div
          className="pcm-alert__progress"
          style={{
            animationDuration: `${duration}ms`,
            backgroundColor: cfg.accent,
          }}
        />
      </div>
    </div>
  );
}
