import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { createSocket } from "../socket.js";
import Avatar from "../components/Avatar.jsx";

function timeOf(dateString) {
  return new Date(dateString).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(dateString) {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dateOf(dateString) {
  const d = new Date(dateString);
  const today = new Date();
  if (dayKey(d) === dayKey(today)) return "Сегодня";
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(yest)) return "Вчера";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export default function Messages() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get("/messages/conversations");
      setConversations(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const loadChat = useCallback(async (uid) => {
    const res = await api.get(`/messages/${uid}`);
    setMessages(res.data);
    setActive(uid);
    window.dispatchEvent(new Event("messages:read"));
    try {
      const p = await api.get(`/users/${uid}`);
      setActiveUser(p.data);
    } catch (e) {
      setActiveUser(null);
    }
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    socketRef.current = createSocket(localStorage.getItem("token"));
    socketRef.current.on("message:new", (msg) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        return exists ? prev : [...prev, msg];
      });
      loadConversations();
    });
    socketRef.current.on("messages:read", ({ ids }) => {
      const readSet = new Set((ids || []).map(String));
      setMessages((prev) =>
        prev.map((m) => (readSet.has(String(m.id)) ? { ...m, read: true } : m))
      );
      loadConversations();
    });
    socketRef.current.on("message:edited", (msg) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id) === String(msg.id) ? { ...m, text: msg.text, edited: true } : m
        )
      );
      loadConversations();
    });
    socketRef.current.on("message:deleted", ({ id }) => {
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(id)));
      loadConversations();
    });
    return () => socketRef.current?.disconnect();
  }, [loadConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (userId) loadChat(userId);
    else {
      setActive(null);
      setActiveUser(null);
    }
  }, [userId, loadChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    const tempId = Math.random().toString(36).slice(2);
    const optimistic = {
      tempId,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      fromMe: true,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    socketRef.current?.emit("message:send", { to: active, text, tempId }, (res) => {
      if (res?.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.tempId === tempId ? { ...m, id: res.id, pending: false } : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === tempId ? { ...m, error: true, pending: false } : m
          )
        );
      }
    });
  };

  const openChat = (uid) => navigate(`/messages/${uid}`);

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditText(m.text);
  };

  const saveEdit = async (id) => {
    const textValue = editText.trim();
    if (!textValue) return;
    setMessages((prev) =>
      prev.map((m) =>
        String(m.id) === String(id) ? { ...m, text: textValue, edited: true } : m
      )
    );
    setEditingId(null);
    try {
      const res = await api.put(`/messages/${id}`, { text: textValue });
      setMessages((prev) =>
        prev.map((m) => (String(m.id) === String(id) ? { ...m, text: res.data.text, edited: true } : m))
      );
    } catch (e) {
      await loadChat(active);
    }
  };

  const deleteMessage = async (id) => {
    if (!window.confirm("Удалить сообщение?")) return;
    setMessages((prev) => prev.filter((m) => String(m.id) !== String(id)));
    try {
      await api.delete(`/messages/${id}`);
    } catch (e) {
      await loadChat(active);
    }
  };

  return (
    <div className="messages-layout">
      <aside className="card conversations">
        <h3>Диалоги</h3>
        {loadingConvs ? (
          <div className="center">Загрузка…</div>
        ) : conversations.length === 0 ? (
          <p className="muted">Диалогов пока нет. Найдите кого-нибудь в «Люди».</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.user.id}
              className={`conv ${active === c.user.id ? "active" : ""}`}
              onClick={() => openChat(c.user.id)}
            >
              <Avatar user={c.user} size={40} />
              <span className="conv-name">
                <strong>
                  {[c.user.firstName, c.user.lastName].filter(Boolean).join(" ").trim() || c.user.username}
                </strong>
                <small className="muted">{c.lastMessage}</small>
              </span>
              {c.unread > 0 && <span className="badge">{c.unread}</span>}
            </button>
          ))
        )}
      </aside>

      <section className="card chat">
        {!active ? (
          <div className="center muted">Выберите диалог слева</div>
        ) : (
          <>
            <header className="chat-header">
              {(() => {
                const name =
                  [activeUser?.firstName, activeUser?.lastName].filter(Boolean).join(" ").trim() ||
                  activeUser?.username ||
                  (() => {
                    const c = conversations.find((x) => x.user.id === active);
                    return c ? [c.user.firstName, c.user.lastName].filter(Boolean).join(" ").trim() || c.user.username : "…";
                  })();
                const avatarUser = activeUser || { username: name };
                return (
                  <>
                    <Avatar user={avatarUser} size={40} />
                    <Link to={`/users/${active}`}>{name}</Link>
                  </>
                );
              })()}
            </header>
            <div className="chat-body">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const showDate = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                return (
                  <div key={m.id || m.tempId} className="msg-group">
                    {showDate && m.createdAt && (
                      <div className="date-divider">{dateOf(m.createdAt)}</div>
                    )}
                    <div className={`msg ${m.fromMe ? "me" : "them"}`}>
                  {m.pending && !m.error && (
                    <span className="msg-state muted">Отправляется…</span>
                  )}
                  {m.error && <span className="msg-state error">Не доставлено</span>}
                  {!m.pending && !m.error && m.fromMe && (
                    <span className={`msg-state ${m.read ? "read" : ""}`}>
                      {m.read ? "Прочитано" : "Отправлено"}
                    </span>
                  )}
                  {editingId === m.id ? (
                    <div className="msg-edit">
                      <textarea
                        className="input msg-edit-input"
                        rows={2}
                        value={editText}
                        autoFocus
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit(m.id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <div className="msg-edit-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(m.id)}>
                          Сохранить
                        </button>
                        <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bubble">{m.text}</div>
                      {m.edited && <span className="msg-edited">Изменено</span>}
                      <span className="muted">{timeOf(m.createdAt)}</span>
                      {!m.pending && !m.error && m.fromMe && (
                        <span className="msg-actions">
                          <button className="msg-action" title="Изменить" onClick={() => startEdit(m)}>
                            Изменить
                          </button>
                          <button className="msg-action" title="Удалить" onClick={() => deleteMessage(m.id)}>
                            Удалить
                          </button>
                        </span>
                      )}
                    </>
                  )}
                  </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <form className="chat-input" onSubmit={send}>
              <textarea
                className="input chat-textarea"
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(e);
                  }
                }}
                placeholder="Сообщение…"
              />
              <button className="btn btn-primary chat-send-btn" type="submit" disabled={!text.trim()}>
                Отправить
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}