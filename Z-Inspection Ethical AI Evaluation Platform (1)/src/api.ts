/// <reference types="vite/client" />

// Merkezi API URL tanımı (sadece .env üzerinden).
// Proje kökündeki (package.json ile aynı klasördeki) `.env` içine örn:
const RAW_API_URL = import.meta.env.VITE_API_URL?.trim();

if (!RAW_API_URL) {
  throw new Error(
    '❌ VITE_API_URL bulunamadı. Proje kökündeki frontend `.env` dosyanıza `VITE_API_URL` ekleyin.'
  );
}

const normalized = RAW_API_URL.replace(/\/+$/, '');
if (!/^https?:\/\//i.test(normalized)) {
  throw new Error(
    `❌ VITE_API_URL geçersiz: "${RAW_API_URL}". "http://..." veya "https://..." ile başlamalı.`
  );
}

export const API_BASE_URL = normalized;

export const api = (path: string) => {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
};

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(api(path), init);
}

