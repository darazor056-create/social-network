import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";
import Avatar from "./Avatar.jsx";

export default function UserCard({ user }) {
  const [following, setFollowing] = useState(user.isFollowing);
  const [loading, setLoading] = useState(false);

  const toggleFollow = async (e) => {
    e.preventDefault();
    if (user.isMe || loading) return;
    setLoading(true);
    try {
      if (following) {
        await api.delete(`/users/${user.id}/follow`);
        setFollowing(false);
      } else {
        await api.post(`/users/${user.id}/follow`);
        setFollowing(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card user-card">
      <Link to={`/users/${user.id}`} className="user-card-link">
        <Avatar user={user} size={48} />
        <div>
          <strong>
            {[user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username}
          </strong>
          <span className="muted">
            {user.followersCount ?? 0} подписчиков · {user.followingCount ?? 0} подписок
          </span>
        </div>
      </Link>
      {!user.isMe && (
        <button
          className={`btn ${following ? "" : "btn-primary"}`}
          style={{ marginLeft: "auto" }}
          onClick={toggleFollow}
          disabled={loading}
        >
          {following ? "Отписаться" : "Подписаться"}
        </button>
      )}
    </div>
  );
}