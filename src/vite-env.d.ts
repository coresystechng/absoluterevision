/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEON_AUTH_URL?: string
  readonly VITE_NEON_DATABASE_URL?: string
  readonly VITE_DROPBOX_OWNER_USER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
