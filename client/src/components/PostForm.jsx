import React, { useState } from "react";
import api from "../api.js";
import Avatar from "./Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function PostForm({ onCreated }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await api.post("/posts/image", fd);
      setImage(res.data.url);
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось загрузить картинку");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/posts", { text, image });
      setText("");
      setImage("");
      onCreated?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось опубликовать");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card post-form" onSubmit={submit}>
      <div className="post-inner">
        <div className="post-form-row">
          <Avatar user={user} size={40} />
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Что у вас нового?"
          />
        </div>
        {image ? (
          <div className="post-image-preview">
            <img src={image} alt="Превью" />
            <button
              type="button"
              className="btn-close-preview"
              title="Убрать картинку"
              onClick={() => setImage("")}
            >
              ×
            </button>
          </div>
        ) : (
          <label className="btn file-upload-btn">
            {uploading ? "Загрузка…" : "Загрузить картинку"}
            <input type="file" accept="image/*" hidden onChange={uploadImage} />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <div className="post-form-actions">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || !text.trim() || uploading}
          >
            {busy ? "Публикуем…" : "Опубликовать"}
          </button>
        </div>
      </div>
    </form>
  );
}