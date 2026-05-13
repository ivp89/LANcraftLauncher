const API_VERSION = "1.0.0";

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiration: string;
}

async function authFetch<T>(serverUrl: string, path: string, options: RequestInit = {}): Promise<T> {
  const url = `${serverUrl.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Version": API_VERSION,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = err.message ?? err.error ?? message;
    } catch {}
    throw new Error(message);
  }

  return response.json();
}

export async function login(serverUrl: string, username: string, password: string): Promise<AuthToken> {
  return authFetch<AuthToken>(serverUrl, "/api/Auth/Login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function register(serverUrl: string, username: string, password: string): Promise<AuthToken> {
  return authFetch<AuthToken>(serverUrl, "/api/Auth/Register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function validateToken(serverUrl: string, token: string): Promise<boolean> {
  try {
    const url = `${serverUrl.replace(/\/$/, "")}/api/Auth/Validate`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-API-Version": API_VERSION,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function refreshToken(serverUrl: string, token: AuthToken): Promise<AuthToken> {
  return authFetch<AuthToken>(serverUrl, "/api/Auth/Refresh", {
    method: "POST",
    body: JSON.stringify(token),
  });
}

export async function logout(serverUrl: string, accessToken: string): Promise<void> {
  try {
    await fetch(`${serverUrl.replace(/\/$/, "")}/api/Auth/Logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-API-Version": API_VERSION,
      },
    });
  } catch {}
}
