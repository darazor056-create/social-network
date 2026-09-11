import { io } from "socket.io-client";

export function createSocket(token) {
  return io("/", {
    auth: { token },
    transports: ["websocket", "polling"],
  });
}