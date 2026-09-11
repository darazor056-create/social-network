import React, { useEffect, useRef, useState } from "react";
import api from "../api.js";
import UserCard from "../components/UserCard.jsx";
import { createSocket } from "../socket.js";

export default function Explore() {
  const [tab, setTab] = useState("followers");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followers, setFollowers] = useState(null);
  const [friends, setFriends] = useState(null);
  const debounceRef = useRef(null);

  const loadPeople = () => {
    api
      .get("/users/me/followers")
      .then((res) => setFollowers(res.data))
      .catch((err) => console.error(err));
    api
      .get("/users/me/friends")
      .then((res) => setFriends(res.data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadPeople();
  }, []);

  useEffect(() => {
    const socket = createSocket(localStorage.getItem("token"));
    socket.on("follow:update", loadPeople);
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get("/users/search", { params: { q } });
        setResults(res.data);
        setSearched(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const friendIds = new Set((friends || []).map((u) => String(u.id)));
  const notFriends = (followers || []).filter((u) => !friendIds.has(String(u.id)));
  const list = tab === "friends" ? friends : followers === null ? null : notFriends;

  return (
    <div>
      <div className="tabs">
        <button
          className={`tab ${tab === "friends" ? "active" : ""}`}
          onClick={() => setTab("friends")}
        >
          Друзья{friends && friends.length > 0 && <span className="nav-badge">{friends.length}</span>}
        </button>
        <button
          className={`tab ${tab === "followers" ? "active" : ""}`}
          onClick={() => setTab("followers")}
        >
          Подписчики{followers && notFriends.length > 0 && <span className="nav-badge">{notFriends.length}</span>}
        </button>
      </div>

      {list === null ? (
        <div className="center">Загрузка…</div>
      ) : list.length === 0 ? (
        <div className="card empty">
          {tab === "friends" ? "Пока нет друзей. Подпишитесь на людей, и они станут друзьями, когда подпишутся на вас." : "Пока никто на вас не подписан"}
        </div>
      ) : (
        list.map((u) => <UserCard key={u.id} user={u} />)
      )}

      <h1 className="section-title" style={{ marginTop: 28 }}>Поиск людей</h1>
      <div className="search-bar">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Введите имя…"
        />
      </div>
      {loading && <div className="center">Поиск…</div>}
      {!loading &&
        searched &&
        (results.length === 0 ? (
          <div className="card empty">Никого не найдено</div>
        ) : (
          results.map((u) => <UserCard key={u.id} user={u} />)
        ))}
    </div>
  );
}