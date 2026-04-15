/**
 * Socket.io wiring — one connection per client, typed events, services
 * injected via closure.
 */
import type { Server as HttpServer } from "node:http";
import { Server as IoServer } from "socket.io";
import type { Services } from "../services/services.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./events.js";
import { registerGameHandlers } from "./gameHandler.js";
import { logger } from "../utils/logger.js";

export function attachSocketServer(http: HttpServer, services: Services): IoServer {
  const io = new IoServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(http, {
    cors: {
      origin: services.cfg.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    },
    // Keep payloads tight — 16KB is plenty for game events, and caps DoS.
    maxHttpBufferSize: 16 * 1024,
  });

  io.on("connection", (socket) => {
    logger.debug({ id: socket.id }, "socket connected");
    registerGameHandlers(io, socket, services);
    socket.on("disconnect", (reason) =>
      logger.debug({ id: socket.id, reason }, "socket disconnected"),
    );
  });

  return io;
}
