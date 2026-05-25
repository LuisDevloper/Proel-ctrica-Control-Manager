import React, { useState } from "react";
import { cn } from "../../lib/utils";

/**
 * Muestra el logo de la aplicacion desde /public/logo.png
 * Si no existe, muestra un placeholder con las iniciales "PE".
 * Para cambiar el logo: reemplaza el archivo public/logo.png
 */
export function AppLogo({ className, size = "md" }) {
  const [failed, setFailed] = useState(false);

  const sizes = {
    sm:  "h-7 w-7 text-xs",
    md:  "h-10 w-10 text-sm",
    lg:  "h-16 w-16 text-xl",
    xl:  "h-28 w-28 text-3xl"
  };

  if (failed) {
    return (
      <div className={cn(
        "rounded-xl bg-gradient-to-br from-[#2f8dff] to-[#1354a8] flex items-center justify-center font-bold text-white shrink-0",
        sizes[size],
        className
      )}>
        PE
      </div>
    );
  }

  return (
    <img
      src="./logo.png"
      alt="Proelectrica"
      className={cn("app-logo object-contain shrink-0", className)}
      style={size === "sm" ? { height: "28px" } : size === "md" ? { height: "40px" } : size === "lg" ? { height: "64px" } : { height: "150px" }}
      onError={() => setFailed(true)}
    />
  );
}
