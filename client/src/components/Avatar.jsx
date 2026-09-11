import React, { useState } from "react";

const DEFAULT_AVATAR = "/uploads/default-avatar.png";

const COLORS = [
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
];

function hash(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Avatar({ user, size = 40 }) {
  const name = user?.username || "?";
  const letterSource = user?.firstName || user?.username || "?";
  const letter = letterSource[0]?.toUpperCase() || "?";
  const bg = COLORS[hash(name) % COLORS.length];
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="avatar avatar-fallback"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.45,
          background: bg,
        }}
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      className="avatar"
      style={{ width: size, height: size }}
      src={user?.avatar || DEFAULT_AVATAR}
      alt={name}
      onError={() => setFailed(true)}
    />
  );
}