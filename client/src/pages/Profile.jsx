import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { createSocket } from "../socket.js";
import Avatar from "../components/Avatar.jsx";
import PostCard from "../components/PostCard.jsx";
import PostForm from "../components/PostForm.jsx";
import UserCard from "../components/UserCard.jsx";

export default function Profile() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const target = id === "me" ? "me" : id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("posts");
  const [list, setList] = useState([]);
  const [loadError, setLoadError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, postsRes] = await Promise.all([
        api.get(`/users/${target}`),
        api.get(`/posts/user/${target}`),
      ]);
      setProfile(p.data);
      setPosts(postsRes.data);
    } catch (e) {
      setLoadError("Пользователь не найден");
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    setTab("posts");
    setList([]);
    loadAll();
  }, [target, loadAll]);

  useEffect(() => {
    const socket = createSocket(localStorage.getItem("token"));
    const onFollow = () => {
      loadAll();
      if (tab !== "posts" && profile) {
        loadList(tab);
      }
    };
    socket.on("follow:update", onFollow);
    return () => socket.disconnect();
  }, [target, loadAll, tab, profile]);

  const toggleFollow = async () => {
    if (!profile || profile.isFollowing) {
      await api.delete(`/users/${target}/follow`);
      setProfile((p) => ({ ...p, isFollowing: false, followersCount: p.followersCount - 1 }));
    } else {
      await api.post(`/users/${target}/follow`);
      setProfile((p) => ({ ...p, isFollowing: true, followersCount: p.followersCount + 1 }));
    }
  };

  const loadList = async (kind) => {
    setTab(kind);
    if (!profile) return;
    const res = await api.get(`/users/${target}/${kind}`);
    setList(res.data);
  };

  if (loading) return <div className="center">Загрузка…</div>;
  if (loadError) return <div className="card empty">{loadError}</div>;

  const isMe = profile.id === me.id;
  const profileName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div>
      <div className="card profile-header">
        <div className="profile-avatar-wrap">
          <Avatar user={profile} size={104} />
        </div>
        <div className="profile-info">
          <h1>{profileName || profile.username}</h1>
          {profileName && <p className="profile-username">@{profile.username}</p>}
          {profile.bio && <p className="bio">{profile.bio}</p>}
          <div className="profile-stats">
            <button className="stat" onClick={() => loadList("followers")}>
              <strong>{profile.followersCount}</strong> подписчиков
            </button>
            <button className="stat" onClick={() => loadList("following")}>
              <strong>{profile.followingCount}</strong> подписок
            </button>
            <button className="stat" onClick={() => loadList("friends")}>
              <strong>{profile.friendsCount ?? 0}</strong> друзей
            </button>
          </div>
        </div>
        <div className="profile-actions">
          {isMe ? (
            <Link className="btn" to="/settings">Настройки</Link>
          ) : (
            <button
              className={`btn ${profile.isFollowing ? "" : "btn-primary"}`}
              onClick={toggleFollow}
            >
              {profile.isFollowing ? "Отписаться" : "Подписаться"}
            </button>
          )}
          {!isMe && (
            <Link className="btn" to={`/messages/${profile.id}`}>Написать</Link>
          )}
        </div>
      </div>

      {tab === "posts" ? (
        <>
          {isMe && (
            <PostForm onCreated={(post) => setPosts((p) => [post, ...p])} />
          )}
          {posts.length === 0 ? (
            <div className="card empty">Пока нет постов</div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={() => setPosts((p) => p.filter((x) => x.id !== post.id))} />
            ))
          )}
        </>
      ) : (
        <div>
          <h3 className="section-title">
            {tab === "followers" ? "Подписчики" : tab === "friends" ? "Друзья" : "Подписки"}
            <button className="btn btn-ghost" onClick={() => setTab("posts")}>← назад</button>
          </h3>
          {list.length === 0 ? (
            <div className="card empty">Никого нет</div>
          ) : (
            list.map((u) => <UserCard key={u.id} user={u} />)
          )}
        </div>
      )}
    </div>
  );
}