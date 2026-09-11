import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Post from "../models/Post.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postImagesDir = path.join(__dirname, "..", "uploads", "post-images");
fs.mkdirSync(postImagesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, postImagesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${req.userId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      file.mimetype
    );
    cb(ok ? null : new Error("Можно загружать только изображения (JPG, PNG, WEBP, GIF)"), ok);
  },
});

const uploadImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json({ error: err.message || "Не удалось загрузить файл" });
    }
    next();
  });
};

const router = express.Router();

router.post("/image", auth, uploadImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Файл не получен" });
    }
    const url = `${req.protocol}://${req.get("host")}/uploads/post-images/${req.file.filename}`;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

const populatePost = (post, meId) => ({
  id: post._id,
  text: post.text,
  image: post.image,
  createdAt: post.createdAt,
  author: post.author
    ? {
        id: post.author._id,
        username: post.author.username,
        avatar: post.author.avatar,
      }
    : null,
  likesCount: post.likes.length,
  likedByMe: post.likes.some((l) => String(l) === String(meId)),
  comments: post.comments
    .map((c) => ({
      id: c._id,
      text: c.text,
      createdAt: c.createdAt,
      user: c.user
        ? {
            id: c.user._id,
            username: c.user.username,
            avatar: c.user.avatar,
          }
        : null,
    }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
});

router.get("/feed", auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const me = await User.findById(req.userId);
  const ids = me.following;
  const posts = await Post.find({ author: { $in: ids } })
    .populate("author", "username avatar")
    .populate("comments.user", "username avatar")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json(posts.map((p) => populatePost(p, req.userId)));
});

router.get("/user/:userId", auth, async (req, res) => {
  const targetId =
    req.params.userId === "me" ||
    !mongoose.Types.ObjectId.isValid(req.params.userId)
      ? req.userId
      : req.params.userId;
  const posts = await Post.find({ author: targetId })
    .populate("author", "username avatar")
    .populate("comments.user", "username avatar")
    .sort({ createdAt: -1 });
  res.json(posts.map((p) => populatePost(p, req.userId)));
});

router.post("/", auth, async (req, res) => {
  const { text, image } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Пост не может быть пустым" });
  }
  const post = await Post.create({
    author: req.userId,
    text: text.trim().slice(0, 2000),
    image: typeof image === "string" ? image : "",
  });
  const full = await post.populate("author", "username avatar");
  res.status(201).json(populatePost(full, req.userId));
});

router.delete("/:id", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });
  if (String(post.author) !== String(req.userId)) {
    return res.status(403).json({ error: "Нельзя удалить чужой пост" });
  }
  await post.deleteOne();
  res.json({ ok: true });
});

router.post("/:id/like", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });
  const idx = post.likes.findIndex((l) => String(l) === String(req.userId));
  if (idx === -1) {
    post.likes.push(req.userId);
  } else {
    post.likes.splice(idx, 1);
  }
  await post.save();
  res.json({
    likedByMe: idx === -1,
    likesCount: post.likes.length,
  });
});

router.post("/:id/comments", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });
  const text = (req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Комментарий пуст" });
  post.comments.push({ user: req.userId, text: text.slice(0, 500) });
  await post.save();
  const comment = post.comments[post.comments.length - 1];
  const commenter = await User.findById(req.userId);
  res.status(201).json({
    id: comment._id,
    text: comment.text,
    createdAt: comment.createdAt,
    user: {
      id: commenter._id,
      username: commenter.username,
      avatar: commenter.avatar,
    },
  });
});

router.delete("/:id/comments/:commentId", auth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });
  const comment = post.comments.id(req.params.commentId);
  if (!comment) return res.status(404).json({ error: "Комментарий не найден" });
  if (String(comment.user) !== String(req.userId)) {
    return res.status(403).json({ error: "Нельзя удалить чужой комментарий" });
  }
  comment.deleteOne();
  await post.save();
  res.json({ ok: true });
});

export default router;