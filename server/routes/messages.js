import express from "express";
import Message from "../models/Message.js";
import auth from "../middleware/auth.js";
import { emit } from "../live.js";

const router = express.Router();

router.get("/conversations", auth, async (req, res) => {
  const messages = await Message.find({
    $or: [{ sender: req.userId }, { recipient: req.userId }],
  })
    .populate("sender", "username avatar firstName lastName")
    .populate("recipient", "username avatar firstName lastName")
    .sort({ createdAt: -1 });

  const map = new Map();
  for (const m of messages) {
    const other =
      String(m.sender._id) === String(req.userId) ? m.recipient : m.sender;
    const key = String(other._id);
    if (!map.has(key)) {
      map.set(key, {
        user: {
          id: other._id,
          username: other.username,
          firstName: other.firstName,
          lastName: other.lastName,
          avatar: other.avatar,
        },
        lastMessage: m.text,
        lastMessageAt: m.createdAt,
        unread:
          String(m.recipient._id) === String(req.userId) && !m.read ? 1 : 0,
      });
    } else if (String(m.recipient._id) === String(req.userId) && !m.read) {
      map.get(key).unread += 1;
    }
  }
  res.json([...map.values()]);
});

router.get("/:userId", auth, async (req, res) => {
  const otherId = req.params.userId;
  const messages = await Message.find({
    $or: [
      { sender: req.userId, recipient: otherId },
      { sender: otherId, recipient: req.userId },
    ],
  })
    .populate("sender", "username avatar")
    .sort({ createdAt: 1 });

  const toRead = messages
    .filter((m) => String(m.sender._id) === String(otherId) && !m.read)
    .map((m) => m._id);

  if (toRead.length) {
    await Message.updateMany(
      { sender: otherId, recipient: req.userId, read: false },
      { read: true }
    );
    emit(`user:${otherId}`, "messages:read", { ids: toRead });
  }

  const meId = String(req.userId);
  const out = messages.map((m) => {
    const fromMe = String(m.sender._id) === meId;
    return {
      id: m._id,
      text: m.text,
      createdAt: m.createdAt,
      read: fromMe ? m.read : true,
      sender: { id: m.sender._id, username: m.sender.username },
      fromMe,
      edited: !!m.edited,
    };
  });
  res.json(out);
});

router.post("/:userId", auth, async (req, res) => {
  const { text } = req.body;
  const message = await Message.create({
    sender: req.userId,
    recipient: req.params.userId,
    text: (text || "").trim().slice(0, 2000),
  });
  if (!message.text) return res.status(400).json({ error: "Сообщение пустое" });
  const populated = await message.populate("sender", "username avatar");
  res.status(201).json({
    id: populated._id,
    text: populated.text,
    createdAt: populated.createdAt,
    read: populated.read,
    fromMe: true,
    edited: false,
  });
});

const serializeMessage = (m, meId) => {
  const fromMe = String(m.sender._id) === meId || String(m.sender) === meId;
  return {
    id: m._id,
    text: m.text,
    createdAt: m.createdAt,
    read: fromMe ? m.read : true,
    sender: {
      id: m.sender._id || m.sender,
      username: m.sender.username || undefined,
    },
    fromMe,
    edited: m.edited,
  };
};

router.put("/:id", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id).populate(
      "sender",
      "username avatar"
    );
    if (!message) return res.status(404).json({ error: "Сообщение не найдено" });
    if (String(message.sender._id) !== String(req.userId)) {
      return res.status(403).json({ error: "Нельзя редактировать чужое сообщение" });
    }
    const text = (req.body?.text || "").trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: "Сообщение пустое" });
    message.text = text;
    message.edited = true;
    await message.save();

    const payload = serializeMessage(message, String(req.userId));
    emit(`user:${String(message.sender._id)}`, "message:edited", payload);
    emit(`user:${String(message.recipient)}`, "message:edited", payload);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: "Сообщение не найдено" });
    if (String(message.sender) !== String(req.userId)) {
      return res.status(403).json({ error: "Нельзя удалить чужое сообщение" });
    }
    const id = String(message._id);
    const sender = String(message.sender);
    const recipient = String(message.recipient);
    await message.deleteOne();

    const payload = { id, text: message.text };
    emit(`user:${sender}`, "message:deleted", payload);
    emit(`user:${recipient}`, "message:deleted", payload);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;