import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const DbHealthContext = createContext(null);

export function DbHealthProvider({ children }) {
  const [status, setStatus] = useState(null); // null comprobando | true | false

  const ping = useCallback(async () => {
    try {
      const r = await window.proelectricaApi.dbPing();
      setStatus(r?.ok === true);
    } catch {
      setStatus(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.proelectricaApi.dbPing();
        if (!cancelled) setStatus(r?.ok === true);
      } catch {
        if (!cancelled) setStatus(false);
      }
    })();
    const id = setInterval(() => {
      if (!cancelled) ping();
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ping]);

  const refresh = useCallback(async () => {
    setStatus(null);
    try {
      const r = await window.proelectricaApi.dbPing();
      const ok = r?.ok === true;
      setStatus(ok);
      return ok;
    } catch {
      setStatus(false);
      return false;
    }
  }, []);

  const value = {
    status,
    refresh,
    /** Solo true cuando la BD respondio ok (no null inicial). */
    dbWritable: status === true,
  };

  return (
    <DbHealthContext.Provider value={value}>
      {children}
    </DbHealthContext.Provider>
  );
}

export function useDbHealth() {
  const ctx = useContext(DbHealthContext);
  if (!ctx) throw new Error("useDbHealth debe usarse dentro de DbHealthProvider");
  return ctx;
}
