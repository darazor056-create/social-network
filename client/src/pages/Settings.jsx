import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  const [bio, setBio] = useState(user?.bio || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [username, setUsername] = useState(user?.username || "");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const res = await api.put("/users/me", { bio, avatar, firstName, lastName, username });
      setUser(res.data);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err.response?.data?.error || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await api.post("/users/avatar", fd);
      setAvatar(res.data.url);
    } catch (err) {
      alert(err.response?.data?.error || "Не удалось загрузить фото");
    }
    e.target.value = "";
  };

  const deleteAccount = async () => {
    if (!window.confirm("Удалить аккаунт? Профиль будет скрыт. Чтобы восстановить его, войди в аккаунт с этим же email и паролем.")) return;
    try {
      await api.delete("/users/me");
      alert("Аккаунт удалён. Войди в аккаунт, чтобы восстановить его.");
      logout();
      navigate("/login");
    } catch (err) {
      alert(err.response?.data?.error || "Не удалось удалить аккаунт");
    }
  };

  return (
    <div>
      {saved && <div className="toast toast-success">Изменения сохранены</div>}
      <form className="card profile-edit-form" onSubmit={saveEdit}>
        <div className="edit-header">
          <h3>Настройки</h3>
        </div>

        <div className="settings-avatar-row">
          <Avatar user={{ ...user, avatar }} size={72} />
          <label className="btn file-upload-btn">
            Загрузить фото
            <input type="file" accept="image/*" hidden onChange={uploadAvatar} />
          </label>
        </div>

        <div className="field">
          <label className="input-label" htmlFor="set-username">Никнейм <span className="req">*</span></label>
          <input
            id="set-username"
            className={`input ${saveError ? "invalid" : ""}`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Латиница, цифры, _ или - (3–30)"
            minLength={3}
            maxLength={30}
            required
          />
          {saveError && <p className="field-error">{saveError}</p>}
        </div>
        <div className="name-fields">
          <div>
            <label className="input-label" htmlFor="set-first">Имя <span className="req">*</span></label>
            <input
              id="set-first"
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Анна"
              maxLength={40}
              required
            />
          </div>
          <div>
            <label className="input-label" htmlFor="set-last">Фамилия</label>
            <input
              id="set-last"
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Смирнова"
              maxLength={40}
            />
          </div>
        </div>
        <label className="input-label" htmlFor="set-bio">О себе</label>
        <textarea
          id="set-bio"
          className="input"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Расскажите о себе"
        />

        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>

        <div className="edit-footer-danger">
          <button className="btn btn-danger-text" type="button" onClick={deleteAccount}>Удалить аккаунт</button>
        </div>
      </form>
    </div>
  );
}