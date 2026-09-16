import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import auth from "../middleware/auth.js";
import { expandNameForms } from "../name-forms.js";
import { emit } from "../live.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads", "avatars");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ].includes(file.mimetype);
    cb(ok ? null : new Error("Можно загружать только изображения (JPG, PNG, WEBP, GIF)"), ok);
  },
});

const uploadAvatar = (req, res, next) => {
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json({ error: err.message || "Не удалось загрузить файл" });
    }
    next();
  });
};

const router = express.Router();

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const resolveTarget = (id, userId) =>
  id === "me" || !isValidId(id) ? userId : id;

const publicUser = async (id, meId) => {
  const user = await User.findById(id).lean();
  if (!user) return null;
  if (user.deleted && String(id) !== String(meId)) return null;
  const own = meId && String(meId) === String(id);
  const followerIds = new Set(user.followers.map(String));
  const friendsCount = user.following.filter((fid) => followerIds.has(String(fid))).length;
  return {
    id: user._id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio,
    avatar: user.avatar,
    followersCount: user.followers.length,
    followingCount: user.following.length,
    friendsCount,
    createdAt: user.createdAt,
    isFollowing: !own && user.followers.some((f) => String(f) === String(meId)),
    isMe: !!own,
  };
};

router.get("/search", auth, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  const forms = expandNameForms(q);
const re = new RegExp("(" + forms.map(escapeRegex).join("|") + ")", "i");
const users = await User.find({
  deleted: { $ne: true },
  $or: [{ username: re }, { firstName: re }, { lastName: re }],
}).limit(20);
  const result = await Promise.all(users.map((u) => publicUser(u._id, req.userId)));
  res.json(result.filter(Boolean));
});

router.get("/:id", auth, async (req, res) => {
  const targetId = resolveTarget(req.params.id, req.userId);
  if (!isValidId(targetId)) return res.status(404).json({ error: "Пользователь не найден" });
  const profile = await publicUser(targetId, req.userId);
  if (!profile) return res.status(404).json({ error: "Пользователь не найден" });
  res.json(profile);
});

router.post("/:id/follow", auth, async (req, res) => {
  const target = resolveTarget(req.params.id, req.userId);
  if (!isValidId(target)) return res.status(404).json({ error: "Пользователь не найден" });
  if (String(target) === String(req.userId)) {
    return res.status(400).json({ error: "Нельзя подписаться на себя" });
  }
  const me = await User.findById(req.userId);
  const other = await User.findById(target);
  if (!me || !other) return res.status(404).json({ error: "Пользователь не найден" });

  if (me.following.includes(other._id)) {
    return res.status(400).json({ error: "Вы уже подписаны" });
  }
  me.following.push(other._id);
  other.followers.push(me._id);
  await me.save();
  await other.save();
  const actor = await User.findById(req.userId).select("username firstName avatar");
  if (String(actor._id) !== String(other._id)) {
    const notif = await Notification.create({
      recipient: other._id,
      actor: actor._id,
      type: "follow",
    });
    emit(`user:${target}`, "notification:new", {
      id: notif._id,
      type: "follow",
      read: false,
      createdAt: notif.createdAt,
      post: null,
      actor: {
        id: actor._id,
        username: actor.username,
        firstName: actor.firstName,
        avatar: actor.avatar,
      },
    });
  }
  emit(`user:${target}`, "follow:update", { from: req.userId });
  emit(`user:${req.userId}`, "follow:update", { to: target });
  res.json({ isFollowing: true });
});

router.delete("/:id/follow", auth, async (req, res) => {
  const target = resolveTarget(req.params.id, req.userId);
  if (!isValidId(target)) return res.status(404).json({ error: "Пользователь не найден" });
  const me = await User.findById(req.userId);
  const other = await User.findById(target);
  if (!me || !other) return res.status(404).json({ error: "Пользователь не найден" });

  me.following = me.following.filter((f) => String(f) !== String(target));
  other.followers = other.followers.filter((f) => String(f) !== String(req.userId));
  await me.save();
  await other.save();
  emit(`user:${target}`, "follow:update", { from: req.userId });
  emit(`user:${req.userId}`, "follow:update", { to: target });
  res.json({ isFollowing: false });
});

router.get("/:id/following", auth, async (req, res) => {
  const targetId = resolveTarget(req.params.id, req.userId);
  if (!isValidId(targetId)) return res.status(404).json({ error: "Пользователь не найден" });
  const user = await User.findById(targetId).populate("following");
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  const result = await Promise.all(user.following.map((u) => publicUser(u._id, req.userId)));
  res.json(result.filter(Boolean));
});

router.get("/:id/followers", auth, async (req, res) => {
  const targetId = resolveTarget(req.params.id, req.userId);
  if (!isValidId(targetId)) return res.status(404).json({ error: "Пользователь не найден" });
  const user = await User.findById(targetId).populate("followers");
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  const result = await Promise.all(user.followers.map((u) => publicUser(u._id, req.userId)));
  res.json(result.filter(Boolean));
});

router.get("/:id/friends", auth, async (req, res) => {
  const targetId = resolveTarget(req.params.id, req.userId);
  if (!isValidId(targetId)) return res.status(404).json({ error: "Пользователь не найден" });
  const user = await User.findById(targetId);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  const followerIds = new Set(user.followers.map(String));
  const friendIds = user.following.filter((fid) => followerIds.has(String(fid)));
  const friends = await User.find({ _id: { $in: friendIds } });
  const result = await Promise.all(friends.map((u) => publicUser(u._id, req.userId)));
  res.json(result.filter(Boolean));
});

router.post("/avatar", auth, uploadAvatar, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Файл не получен" });
    }
    const url = `${req.protocol}://${req.get("host")}/uploads/avatars/${req.file.filename}`;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    user.avatar = url;
    await user.save();
    res.json({ url, user: user.jsonPublic() });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });

    user.deleted = true;
    user.deletedAt = new Date();
    await user.save();

    emit(`user:${req.userId}`, "account:deleted", {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/me/restore", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (!user.deleted) return res.status(400).json({ error: "Аккаунт не удалён" });

    user.deleted = false;
    user.deletedAt = null;
    await user.save();

    res.json({ user: user.jsonPublic() });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.put("/me", auth, async (req, res) => {
  try {
    const { bio, avatar, firstName, lastName, username } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (typeof username === "string") {
      const u = username.trim();
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(u)) {
        return res.status(400).json({ error: "Ник должен содержать только английские буквы, цифры, _ или - (3–30 символов)" });
      }
      const exists = await User.findOne({ username: u, _id: { $ne: req.userId } });
      if (exists) {
        return res.status(400).json({ error: "Этот ник уже занят" });
      }
      user.username = u;
    }
    if (typeof bio === "string") user.bio = bio.slice(0, 200);
    if (typeof avatar === "string") user.avatar = avatar;
    if (typeof firstName === "string") {
      const f = firstName.trim().slice(0, 40);
      if (!f) {
        return res.status(400).json({ error: "Имя обязательно" });
      }
      user.firstName = f;
    }
    if (typeof lastName === "string") user.lastName = lastName.trim().slice(0, 40);
    await user.save();
    res.json(user.jsonPublic());
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;