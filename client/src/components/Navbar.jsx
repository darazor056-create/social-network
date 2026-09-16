import React, { useCallback, useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api.js";
import { createSocket } from "../socket.js";
import Avatar from "./Avatar.jsx";

const feedIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h7v9H3z" /><path d="M14 3h7v5h-7z" /><path d="M14 12h7v9h-7z" /><path d="M3 16h7v5H3z" />
  </svg>
);
const peopleIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const chatIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const userIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const bellIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const settingsIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const logoutIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const res = await api.get("/messages/conversations");
      setUnread(res.data.reduce((s, c) => s + (c.unread || 0), 0));
    } catch (e) {
      // игнорируем
    }
  }, []);

  const loadFollowers = useCallback(async () => {
    try {
      const res = await api.get("/users/me/followers");
      setFollowersCount(res.data.filter((u) => !u.isFollowing).length);
    } catch (e) {
      // игнорируем
    }
  }, []);

  const loadNotifCount = useCallback(async () => {
    try {
      const res = await api.get("/notifications/unread");
      setNotifCount(res.data.count);
    } catch (e) {
      // игнорируем
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadUnread();
    loadFollowers();
    loadNotifCount();
    const socket = createSocket(localStorage.getItem("token"));
    socket.on("message:new", loadUnread);
    socket.on("messages:read", loadUnread);
    socket.on("follow:update", loadFollowers);
    socket.on("notification:new", loadNotifCount);
    const onRead = () => loadUnread();
    window.addEventListener("messages:read", onRead);
    return () => {
      socket.disconnect();
      window.removeEventListener("messages:read", onRead);
    };
  }, [user, loadUnread, loadFollowers]);

  useEffect(() => {
    if (user) {
      loadUnread();
      loadFollowers();
      loadNotifCount();
    }
  }, [location.pathname, user, loadUnread, loadFollowers, loadNotifCount]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <NavLink to={user ? "/" : "/login"} className="brand">
          <span className="brand-logo">П</span>
          Пульс
        </NavLink>
        <nav className="sidebar-nav">
          {user ? (
            <>
              <NavLink to="/" className="nav-link" end>{feedIcon} Лента</NavLink>
              <NavLink to="/explore" className="nav-link">{peopleIcon} Люди{followersCount > 0 && <span className="nav-badge">{followersCount}</span>}</NavLink>
              <NavLink to="/messages" className="nav-link">
                {chatIcon} Сообщения
                {unread > 0 && <span className="nav-badge">{unread}</span>}
              </NavLink>
              <NavLink to="/me" className="nav-link">{userIcon} Профиль</NavLink>
              <NavLink to="/notifications" className="nav-link">
                {bellIcon} Уведомления
                {notifCount > 0 && <span className="nav-badge">{notifCount}</span>}
              </NavLink>
              <NavLink to="/settings" className="nav-link">{settingsIcon} Настройки</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">Вход</NavLink>
              <NavLink to="/register" className="nav-link">Регистрация</NavLink>
            </>
          )}
        </nav>
      </div>

      {user && (
        <div className="sidebar-user">
          <Link to="/me" className="sidebar-user-link" title="Мой профиль">
            <Avatar user={user} size={36} />
            <span className="sidebar-user-info">
              <strong>{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}</strong>
              <small>@{user.username}</small>
            </span>
          </Link>
        </div>
      )}

      {user && (
        <button className="sidebar-logout" onClick={handleLogout}>
          {logoutIcon} Выход
        </button>
      )}
    </aside>
  );
}