import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";
import Avatar from "../components/Avatar.jsx";
import { createSocket } from "../socket.js";

function timeAgo(dateString) {
  const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return new Date(dateString).toLocaleDateString("ru-RU");
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = createSocket(localStorage.getItem("token"));
    socket.on("notification:new", () => load());
    return () => socket.disconnect();
  }, [load]);

  const markRead = async () => {
    try {
      await api.post("/notifications/read", { ids: [] });
      setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (notifications.some((n) => !n.read)) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length]);

  const text = (n) => {
    const name = n.actor?.firstName || n.actor?.username || "Пользователь";
    switch (n.type) {
      case "follow":
        return <span><strong>{name}</strong> подписался(лась) на вас</span>;
      case "like":
        return <span><strong>{name}</strong> оценил(а) ваш пост</span>;
      case "comment":
        return <span><strong>{name}</strong> прокомментировал(а) ваш пост</span>;
    }
  };

  const href = (n) => (n.post ? `/users/me` : `/users/${n.actor?.id}`);

  return (
    <div>
      <h1 className="section-title">Уведомления</h1>
      {loading ? (
        <div className="center">Загрузка…</div>
      ) : notifications.length === 0 ? (
        <div className="card empty">Пока нет уведомлений</div>
      ) : (
        notifications.map((n) => (
          <Link key={n.id} to={href(n)} className={`notification ${n.read ? "" : "unread"}`}>
            <Avatar user={n.actor} size={36} />
            <div className="notification-body">
              {text(n)}
              <span className="muted">{timeAgo(n.createdAt)}</span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}