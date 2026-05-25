const LOGIN_BACKGROUND = "./login-background.png";

/** Fondo de pantalla completa del login (viewport, estático — sin Ken Burns). */
export function LoginBackdrop() {
  return (
    <div className="login-backdrop fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0 bg-[#0a1018] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${LOGIN_BACKGROUND})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#07101dcc] via-[#0a1528b3] to-[#050a12e6]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#050a12aa_68%,#03060dcc_100%)]" />
    </div>
  );
}
