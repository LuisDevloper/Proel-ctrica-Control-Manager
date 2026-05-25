import React from "react";
import { cn } from "../../lib/utils";

const ICON_SRC = "./icons/electric-motor.png";

/** Icono de motor electrico industrial (silueta lateral). */
export function ElectricMotorIcon({ size = 24, className, ...props }) {
  return (
    <span
      role="img"
      aria-hidden="true"
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url("${ICON_SRC}")`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage: `url("${ICON_SRC}")`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
      {...props}
    />
  );
}
