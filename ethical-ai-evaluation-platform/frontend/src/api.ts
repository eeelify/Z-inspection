/// <reference types="vite/client" />

/**
 * API URL resolution strategy:
 * - DEV: use relative paths (Vite proxy handles forwarding to backend).
 * - PROD: prefer VITE_API_URL, fallback to same-origin.
 *
 * Notes:
 * - In this codebase, `VITE_API_URL` is intended for production deployments.
 * - For local development, we default to the Vite proxy (`/api` -> `http://localhost:5000`)
 *   to avoid accidental calls to a remote environment.
 * - If you really need an explicit dev base URL, set `VITE_DEV_API_URL`.
 */

const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const rawProdApiUrl = import.meta.env.VITE_API_URL?.trim();
const rawDevApiUrl = import.meta.env.VITE_DEV_API_URL?.trim();

const normalizeBaseUrl = (base: string) => base.replace(/\/+$/, '');

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

export const API_BASE_URL = (() => {
  // DEV: default to proxy/same-origin unless an explicit dev base is provided.
  if (import.meta.env.DEV) {
    if (rawDevApiUrl) {
      const normalized = normalizeBaseUrl(rawDevApiUrl);
      if (!isHttpUrl(normalized)) {
        throw new Error(
          `❌ VITE_DEV_API_URL geçersiz: "${rawDevApiUrl}". "http://..." veya "https://..." ile başlamalı.`
        );
      }
      return normalized;
    }
    return '';
  }

  // PROD: If VITE_API_URL is provided, use it; otherwise fallback to same-origin.
  if (rawProdApiUrl) {
    const normalized = normalizeBaseUrl(rawProdApiUrl);
    if (!isHttpUrl(normalized)) {
      throw new Error(
        `❌ VITE_API_URL geçersiz: "${rawProdApiUrl}". "http://..." veya "https://..." ile başlamalı.`
      );
    }
    return normalized;
  }

  // Production fallback: same origin (useful when frontend is served by backend)
  return '';
})();

export const api = (path: string) => {
  const p = normalizePath(path);
  return `${API_BASE_URL}${p}`;
};

export async function apiFetch(path: string, init?: RequestInit) {
  return fetch(api(path), init);
}

