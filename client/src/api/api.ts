import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let accessToken = "";
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// Called by AuthContext so we can clear session state when a refresh
// ultimately fails (e.g. refresh cookie expired or was revoked).
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// The access token is short-lived (15 min) by design. Rather than
// making the user log in again every 15 minutes, transparently use
// the HttpOnly refresh cookie to mint a new one and retry the
// original request exactly once. If that also fails, the refresh
// token itself is invalid/expired, so we log the user out.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .then((response) => {
        const token = response.data.accessToken as string;
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    const isAuthEndpoint =
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/refresh");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retried &&
      !isAuthEndpoint
    ) {
      originalRequest._retried = true;

      try {
        const token = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch {
        setAccessToken("");
        onUnauthorized?.();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;