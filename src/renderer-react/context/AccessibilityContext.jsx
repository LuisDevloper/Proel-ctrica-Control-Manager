import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "pcm-font-scale";
const LEVELS = [100, 112, 125];

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [fontPercent, setFontPercentState] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      const n = parseInt(s, 10);
      return LEVELS.includes(n) ? n : 100;
    } catch {
      return 100;
    }
  });

  const setFontPercent = useCallback((n) => {
    const v = LEVELS.includes(n) ? n : 100;
    setFontPercentState(v);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontPercent}%`;
    try {
      localStorage.setItem(STORAGE_KEY, String(fontPercent));
    } catch {
      /* ignore */
    }
  }, [fontPercent]);

  useEffect(() => {
    function onKey(e) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setFontPercentState((p) => (p === 100 ? 112 : 125));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setFontPercentState((p) => (p === 125 ? 112 : 100));
      } else if (e.key === "0") {
        e.preventDefault();
        setFontPercentState(100);
      } else if (e.key === "Enter") {
        e.preventDefault();
        window.proelectricaApi?.toggleFullscreen?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = {
    fontPercent,
    setFontPercent,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility debe usarse dentro de AccessibilityProvider");
  return ctx;
}
