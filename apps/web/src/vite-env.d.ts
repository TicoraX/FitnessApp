/// <reference types="vite/client" />

/**
 * Solo las variables que el cliente lee de verdad. `vite/client` ya tipa
 * `import.meta.env`, pero deja el índice abierto: declararlas acá hace que un
 * nombre mal escrito sea un error de compilación y no un `undefined` silencioso.
 */
interface ImportMetaEnv {
  /** Base de donde salen las animaciones de los movimientos. Ver MediaMovimiento. */
  readonly VITE_MOVEMENT_MEDIA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Identifica el build. Lo inyecta `define` en vite.config.ts. */
declare const __BUILD_ID__: string;
