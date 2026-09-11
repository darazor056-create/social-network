import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const showIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const hideIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function formatTimeLeft(ms) {
  if (ms <= 0) return "Время истекло";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}д ${hours}ч ${minutes}м ${seconds}с`;
  if (hours > 0) return `${hours}ч ${minutes}м ${seconds}с`;
  return `${minutes}м ${seconds}с`;
}

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [deletedInfo, setDeletedInfo] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [restoring, setRestoring] = useState(false);

  if (user) navigate("/", { replace: true });

  useEffect(() => {
    if (!deletedInfo) return;
    const update = () => {
      const ms = new Date(deletedInfo.restoreBy).getTime() - Date.now();
      setTimeLeft(formatTimeLeft(ms));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [deletedInfo]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDeletedInfo(null);
    try {
      const res = await api.post("/auth/login", { email, password });
      if (res.data.deleted) {
        setDeletedInfo(res.data);
        return;
      }
      login(res.data.token, res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  const restoreAccount = async () => {
    setRestoring(true);
    try {
      const res = await api.post("/auth/restore", { email, password });
      login(res.data.token, res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось восстановить");
      setDeletedInfo(null);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card login-card">
        {deletedInfo ? (
          <>
            <div className="auth-logo">П</div>
            <h1>Аккаунт удалён</h1>
            <p className="subtitle">Аккаунт будет удалён навсегда через:</p>
            <div className="delete-timer">{timeLeft}</div>
            <p className="muted restore-hint">Нажми кнопку ниже, чтобы восстановить профиль и все данные.</p>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" onClick={restoreAccount} disabled={restoring}>
              {restoring ? "Восстановление…" : "Восстановить аккаунт"}
            </button>
            <p className="muted" style={{ marginTop: 12 }}>
              <Link to="/" onClick={() => setDeletedInfo(null)}>← Вернуться к входу</Link>
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="auth-logo">П</div>
            <h1>С возвращением</h1>
            <p className="subtitle">Войдите в свой аккаунт</p>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
            <div className="password-field">
              <input
                className="input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? hideIcon : showIcon}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Входим…" : "Войти"}
            </button>
            <p className="muted">
              Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}