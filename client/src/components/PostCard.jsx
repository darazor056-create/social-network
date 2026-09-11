import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

const trashIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

function timeAgo(dateString) {
  const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return new Date(dateString).toLocaleDateString("ru-RU");
}

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likesCount);
  const [comments, setComments] = useState(post.comments);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  const toggleLike = async () => {
    try {
      const res = await api.post(`/posts/${post.id}/like`);
      setLiked(res.data.likedByMe);
      setLikes(res.data.likesCount);
    } catch (e) {
      console.error(e);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/posts/${post.id}/comments`, {
        text: commentText,
      });
      setComments((c) => [...c, res.data]);
      setCommentText("");
    } catch (err) {
      console.error(err);
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm("Удалить комментарий?")) return;
    try {
      await api.delete(`/posts/${post.id}/comments/${commentId}`);
      setComments((c) => c.filter((x) => x.id !== commentId));
    } catch (err) {
      console.error(err);
    }
  };

  const removePost = async () => {
    if (!window.confirm("Удалить пост?")) return;
    try {
      await api.delete(`/posts/${post.id}`);
      onDelete?.(post.id);
    } catch (err) {
      console.error(err);
    }
  };

  const mine = post.author?.id === user.id;

  return (
    <article className="card">
      <div className="post-header">
        <Link to={`/users/${post.author?.id}`} className="post-author">
          <Avatar user={post.author} size={40} />
          <div>
            <strong>{post.author?.username}</strong>
            <span className="muted">{timeAgo(post.createdAt)}</span>
          </div>
        </Link>
        {mine && (
          <button className="btn btn-danger-small post-remove" title="Удалить пост" onClick={removePost}>{trashIcon}</button>
        )}
      </div>

      <p className="post-text">{post.text}</p>
      {post.image && <img className="post-image" src={post.image} alt="" />}

      <div className="post-actions">
        <button
          className={`btn-like ${liked ? "active" : ""}`}
          onClick={toggleLike}
        >
          <span className="heart">{liked ? "♥" : "♡"}</span> {likes}
        </button>
        <button
          className="btn-ghost-action"
          onClick={() => setShowComments((s) => !s)}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {comments.length}
        </button>
      </div>

      {showComments && (
        <div className="comments">
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <Link to={`/users/${c.user?.id}`} className="comment-avatar">
                <Avatar user={c.user} size={28} />
              </Link>
              <div className="comment-body">
                <strong>{c.user?.username}</strong>
                <span>{c.text}</span>
                <span className="muted">{timeAgo(c.createdAt)}</span>
              </div>
              {c.user?.id === user.id && (
                <button
                  className="btn-danger-small"
                  title="Удалить комментарий"
                  onClick={() => deleteComment(c.id)}
                >
                  {trashIcon}
                </button>
              )}
            </div>
          ))}
          <form className="comment-form" onSubmit={addComment}>
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Написать комментарий…"
            />
            <button className="btn" type="submit">Отправить</button>
          </form>
        </div>
      )}
    </article>
  );
}