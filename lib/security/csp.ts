/**
 * Content Security Policy con nonce por request (D-041). La arma el proxy:
 * Next lee el nonce del header del request y lo aplica a sus scripts.
 *
 * - Scripts: solo con nonce (+ 'strict-dynamic' para los chunks que cargan
 *   ellos mismos). Ningún script inline sin nonce puede ejecutarse.
 * - Estilos: 'unsafe-inline', porque Radix, sonner y dnd-kit escriben estilos
 *   inline. El riesgo de inyectar CSS es mucho menor que el de inyectar JS.
 */
export type CspOptions = {
  nonce: string;
  /** En desarrollo React usa eval para reconstruir stacks de error. */
  isDev: boolean;
  /** URL del proyecto de Supabase (por si el cliente del browser la usa). */
  supabaseUrl: string;
};

export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const supabase = new URL(supabaseUrl);
  const supabaseWs = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Avatares de Google (cuenta vinculada con OAuth).
    "img-src": ["'self'", "blob:", "data:", "https://*.googleusercontent.com"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase.origin, supabaseWs],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // En local se sirve por http: forzar https rompería las llamadas a Supabase.
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Nonce impredecible por request (128 bits en base64). */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
