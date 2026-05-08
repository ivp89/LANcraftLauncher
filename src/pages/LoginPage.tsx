import { useState } from "react";
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
        mode === "login"
          ? await login(serverUrl, username, password)
          : await register(serverUrl, username, password);
      await setAuth(token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(222,47%,11%)]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">LANcraft</h1>
          <p className="text-slate-400 mt-1">Game Launcher</p>
        </div>

        <div className="bg-[hsl(222,47%,15%)] rounded-xl p-6 space-y-5 border border-[hsl(216,34%,25%)]">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Сервер
            </label>
            <ServerDiscovery
              onSelect={(url) => setServerUrl(url)}
              currentUrl={serverUrl}
            />
          </div>

          {serverUrl && (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-lg overflow-hidden border border-[hsl(216,34%,30%)]">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    mode === "login"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Войти
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    mode === "register"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Регистрация
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Имя пользователя
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(216,34%,20%)] border border-[hsl(216,34%,30%)] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(216,34%,20%)] border border-[hsl(216,34%,30%)] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {mode === "register" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Подтверждение пароля
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full px-3 py-2 rounded-lg bg-[hsl(216,34%,20%)] border border-[hsl(216,34%,30%)] text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition-colors"
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
