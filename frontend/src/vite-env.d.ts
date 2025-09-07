/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BITCOIN_GUESSER_BASE: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
