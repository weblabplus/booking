/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HAPIO_API_TOKEN?: string;
  readonly VITE_HAPIO_BASE_URL?: string;
  readonly VITE_MEDILAB_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
