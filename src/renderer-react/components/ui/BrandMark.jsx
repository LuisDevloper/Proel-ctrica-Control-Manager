/**
 * Marca tipográfica Proélectrica / Control Manager.
 * size: lg (login/splash) | md (splash compact) | sm (sidebar)
 * variant: display (subtítulo en mayúsculas) | compact (subtítulo normal)
 */
export function BrandMark({
  size = "lg",
  variant = "display",
  showRule = false,
  titleAs: TitleTag = "h1",
  className = "",
}) {
  return (
    <div
      className={`brand-mark brand-mark--${size} brand-mark--${variant} ${className}`.trim()}
    >
      <TitleTag className="brand-mark__title">Proélectrica</TitleTag>
      {showRule && <div className="brand-mark__rule" aria-hidden />}
      <p className="brand-mark__subtitle">Control Manager</p>
    </div>
  );
}
