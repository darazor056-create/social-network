import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { setIO } from "./live.js";

process.on("unhandledRejection", (err) =>
  console.error("Неперехваченная ошибка (не крашимся):", err?.message || err)
);
process.on("uncaughtException", (err) =>
  console.error("Необработанное исключение (не крашимся):", err?.message || err)
);

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import messageRoutes from "./routes/messages.js";
import notificationRoutes from "./routes/notifications.js";
import Message from "./models/Message.js";
import User from "./models/User.js";
import { hardDeleteUser } from "./hard-delete.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(import.meta.dirname, "uploads")));

app.use((req, res, next) => {
  console.log(`[req] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Ошибка сервера" });
});

const clientDist = path.join(import.meta.dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.use("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/uploads")) {
    return next();
  }
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "*" },
});
setIO(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Нет авторизации"));
  try {
    const jwt = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    socket.userId = jwt.id;
    next();
  } catch {
    next(new Error("Неверный токен"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.on("message:send", async ({ to, text, tempId }, cb) => {
    try {
      const message = await Message.create({
        sender: socket.userId,
        recipient: to,
        text: (text || "").trim().slice(0, 2000),
      });
      const populated = await message.populate("sender", "username avatar");
      const payload = {
        id: populated._id,
        text: populated.text,
        createdAt: populated.createdAt,
        read: false,
        fromMe: false,
        sender: {
          id: populated.sender._id,
          username: populated.sender.username,
          avatar: populated.sender.avatar,
        },
        tempId,
      };
      io.to(`user:${to}`).emit("message:new", payload);
      cb?.({ ok: true, id: payload.id, tempId });
    } catch (e) {
      cb?.({ ok: false, error: "Не удалось отправить" });
    }
  });
});

const DELETE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

async function cleanupDeletedAccounts() {
  try {
    const cutoff = new Date(Date.now() - DELETE_GRACE_MS);
    const expired = await User.find({ deleted: true, deletedAt: { $lte: cutoff } });
    for (const user of expired) {
      await hardDeleteUser(user._id);
      console.log(`[cleanup] permanently deleted user ${user.username} (${user._id})`);
    }
  } catch (err) {
    console.error("[cleanup] error:", err.message);
  }
}

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB подключена");
  cleanupDeletedAccounts();
  setInterval(cleanupDeletedAccounts, 24 * 60 * 60 * 1000);
  server.listen(process.env.PORT || 5000, () =>
    console.log(`Сервер на http://localhost:${process.env.PORT || 5000}`)
  );
};

start().catch((e) => {
  console.error("Не удалось запустить сервер:", e.message);
  process.exit(1);
});