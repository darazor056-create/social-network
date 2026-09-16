import express from "express";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

const populateNotification = (n) => ({
  id: n._id,
  type: n.type,
  read: n.read,
  createdAt: n.createdAt,
  post: n.post ? { id: n.post._id } : null,
  actor: n.actor
    ? {
        id: n.actor._id,
        username: n.actor.username,
        firstName: n.actor.firstName,
        avatar: n.actor.avatar,
      }
    : null,
});

router.get("/", auth, async (req, res) => {
  const notifications = await Notification.find({ recipient: req.userId })
    .populate("actor", "username firstName avatar")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notifications.map(populateNotification));
});

router.get("/unread", auth, async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.userId,
    read: false,
  });
  res.json({ count });
});

router.post("/read", auth, async (req, res) => {
  const { ids } = req.body;
  const query = { recipient: req.userId, read: false };
  if (Array.isArray(ids) && ids.length) {
    query._id = { $in: ids };
  }
  await Notification.updateMany(query, { read: true });
  res.json({ ok: true });
});

export default router;