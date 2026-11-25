// client/src/services/apiClient.js
// Layer 1 -> Layer 2 HTTP transport helper (no business logic)

const TOKEN_KEY = "ai_learning_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (options.rawText) {
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return response.text();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data && data.error && data.error.message) ||
      `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.code = data && data.error ? data.error.code : "API_ERROR";
    err.status = response.status;
    throw err;
  }
  return data;
}

