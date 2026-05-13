import React, { useState, useEffect } from "react";
import { cn } from "../../lib/utils";

/**
 * Input de costo con formato automatico de comas.
 * Valor interno: numero puro (ej. 1500.50)
 * Valor mostrado: con comas (ej. 1,500.50)
 *
 * Props:
 *   value      – valor numerico actual (string o number)
 *   onChange   – callback(valorNumerico: string)
 *   className
 *   placeholder
 */
export function CurrencyInput({ value, onChange, className, placeholder = "0", id, ...rest }) {
  const [display, setDisplay] = useState("");

  // Sincroniza el display cuando el valor externo cambia (ej. al limpiar el form)
  useEffect(() => {
    if (value === "" || value === null || value === undefined) {
      setDisplay("");
    } else {
      setDisplay(formatWithCommas(String(value)));
    }
  }, [value]);

  function formatWithCommas(raw) {
    // Elimina todo excepto digits y punto decimal
    const clean = raw.replace(/[^0-9.]/g, "");
    // Divide en parte entera y decimal
    const parts  = clean.split(".");
    const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimal = parts.length > 1 ? "." + parts[1].slice(0, 2) : "";
    return integer + decimal;
  }

  function handleChange(e) {
    const input    = e.target.value;
    const formatted = formatWithCommas(input);
    setDisplay(formatted);
    // Devuelve el valor sin comas para almacenar en el estado del form
    const numeric = formatted.replace(/,/g, "");
    onChange(numeric);
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6a8a] text-sm select-none">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-[#355071] bg-[#1a2534] text-[#eaf2fb] pl-7 pr-3 py-2 text-sm outline-none transition-all",
          "placeholder:text-[#9ab0c7]",
          "focus:border-[#2f8dff] focus:ring-2 focus:ring-[#2f8dff33]",
          className
        )}
        {...rest}
      />
    </div>
  );
}
