import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import { hardDeleteUser } from "../hard-delete.js";

const router = express.Router();

const DELETE_GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

router.post("/register", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Заполните все поля" });
    }
    if (!firstName || !String(firstName).trim()) {
      return res.status(400).json({ error: "Имя обязательно" });
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      return res
        .status(400)
        .json({ error: "Ник должен содержать только английские буквы, цифры, _ или - (3–30 символов)" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Пароль должен быть не короче 6 символов" });
    }
    const exists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });
    if (exists) {
      return res
        .status(409)
        .json({ error: "Пользователь с таким email или ником уже существует" });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hash,
      firstName: typeof firstName === "string" ? firstName.trim().slice(0, 40) : "",
      lastName: typeof lastName === "string" ? lastName.trim().slice(0, 40) : "",
    });
    res.status(201).json({ token: signToken(user._id), user: user.jsonPublic() });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Заполните все поля" });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }
    if (user.deleted) {
      const restoreBy = new Date(user.deletedAt.getTime() + DELETE_GRACE_MS);
      if (Date.now() > restoreBy.getTime()) {
        await hardDeleteUser(user._id);
        return res.status(401).json({ error: "Аккаунт удалён навсегда" });
      }
      return res.json({
        deleted: true,
        deletedAt: user.deletedAt,
        restoreBy,
      });
    }
    res.json({ token: signToken(user._id), user: user.jsonPublic() });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/restore", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Заполните все поля" });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.deleted) {
      return res.status(400).json({ error: "Аккаунт не удалён" });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Неверный пароль" });
    }
    const restoreBy = new Date(user.deletedAt.getTime() + DELETE_GRACE_MS);
    if (Date.now() > restoreBy.getTime()) {
      await hardDeleteUser(user._id);
      return res.status(400).json({ error: "Аккаунт удалён навсегда" });
    }
    user.deleted = false;
    user.deletedAt = null;
    await user.save();
    res.json({ token: signToken(user._id), user: user.jsonPublic() });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    res.json(user.jsonPublic());
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;