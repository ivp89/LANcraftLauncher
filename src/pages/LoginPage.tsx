import { useState } from "react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";

import { login, register } from "../api/auth";
import ServerDiscovery from "../components/ServerDiscovery";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";

type Mode = "login" | "register";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { serverUrl, setServerUrl } = useSettingsStore();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!serverUrl) {
      setError("Укажите адрес сервера");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token =
        mode === "login" ? await login(serverUrl, username, password) : await register(serverUrl, username, password);
      await setAuth(token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(222,47%,11%)]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">LANCRAFT</h1>
          <p className="mt-1 text-slate-400">Game Launcher</p>
        </div>

        <div className="space-y-5 rounded-xl border border-[hsl(216,34%,25%)] bg-[hsl(222,47%,15%)] p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Сервер</label>
            <ServerDiscovery onSelect={(url) => setServerUrl(url)} currentUrl={serverUrl} />
          </div>

          {serverUrl && (
            <>
              {/* Mode tabs */}
              <div className="flex overflow-hidden rounded-lg border border-[hsl(216,34%,30%)]">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={clsx(
                    "flex-1 py-2 text-sm font-medium transition-colors",
                    mode === "login" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white",
                  )}
                >
                  Войти
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className={clsx(
                    "flex-1 py-2 text-sm font-medium transition-colors",
                    mode === "register" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white",
                  )}
                >
                  Регистрация
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Имя пользователя</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className={clsx(
                      "w-full rounded-lg border",
                      "border-[hsl(216,34%,30%)] bg-[hsl(216,34%,20%)]",
                      "px-3 py-2 text-white placeholder-slate-500",
                      "focus:border-blue-500 focus:outline-none",
                    )}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Пароль</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className={clsx(
                      "w-full rounded-lg border",
                      "border-[hsl(216,34%,30%)] bg-[hsl(216,34%,20%)]",
                      "px-3 py-2 text-white placeholder-slate-500",
                      "focus:border-blue-500 focus:outline-none",
                    )}
                  />
                </div>

                {mode === "register" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Подтверждение пароля</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={clsx(
                        "w-full rounded-lg border",
                        "border-[hsl(216,34%,30%)] bg-[hsl(216,34%,20%)]",
                        "px-3 py-2 text-white placeholder-slate-500",
                        "focus:border-blue-500 focus:outline-none",
                      )}
                    />
                  </div>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className={clsx(
                    "w-full rounded-lg py-2 font-medium",
                    "bg-blue-600 text-white hover:bg-blue-500",
                    "transition-colors disabled:opacity-50",
                  )}
                >
                  {loading
                    ? mode === "login"
                      ? "Вход…"
                      : "Регистрация…"
                    : mode === "login"
                      ? "Войти"
                      : "Зарегистрироваться"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
