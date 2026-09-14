import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "./lib/prisma";

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ?? "";

type SocketUser = {
  userId: number;
  role: Role;
};

export let socketServer: Server;

let onlineUsers = new Set<number>();

export function getOnlineUserCount() {
  return onlineUsers.size;
}

export type GlobalActivityPayload = {
  id: number;
  taskId: number;
  projectId: number;
  projectName: string;
  taskTitle: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    role: Role;
  };
};

/**
 * Fans a single activity event out to exactly the sockets each role is
 * allowed to see it in, so the dashboard-level "global" feed stays
 * role-scoped in real time without every client having to join every
 * project's room:
 *  - every connected Admin (via the shared `activity:admin` room)
 *  - the Project Manager who owns the project (their personal room)
 *  - the Developer the task is assigned to (their personal room)
 * Anyone currently viewing the project page also gets it via the
 * existing `project:${projectId}` room / `task-status-updated` event.
 */
export function broadcastActivity(
  payload: GlobalActivityPayload,
  pmUserId: number,
  developerUserId: number
) {
  if (!socketServer) return;

  socketServer
    .to("activity:admin")
    .to(`user:${pmUserId}`)
    .to(`user:${developerUserId}`)
    .emit("global-activity", payload);
}

export function setupSocket(io: Server) {
  socketServer = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication required")
      );
    }

    try {
      const user = jwt.verify(
        token,
        ACCESS_TOKEN_SECRET
      ) as SocketUser;

      socket.data.user = user;
      next();
    } catch {
      next(
        new Error("Invalid or expired token")
      );
    }
  });

  io.on("connection", (socket) => {
    const user =
      socket.data.user as SocketUser;

    onlineUsers.add(user.userId);

    socket.join(`user:${user.userId}`);

    // Admins get a dedicated room so the global activity feed
    // can reach them without needing them to join every project.
    if (user.role === "ADMIN") {
      socket.join("activity:admin");
    }

    io.emit("online-users", {
      count: onlineUsers.size,
    });

    socket.on(
      "join-project",
      async (projectId: number) => {
        if (
          !Number.isInteger(projectId) ||
          projectId <= 0
        ) {
          return;
        }

        let allowed = false;

        if (user.role === "ADMIN") {
          allowed = true;
        }

        if (
          user.role === "PROJECT_MANAGER"
        ) {
          const project =
            await prisma.project.findFirst({
              where: {
                id: projectId,
                createdById: user.userId,
              },
            });

          allowed = !!project;
        }

        if (user.role === "DEVELOPER") {
          const task =
            await prisma.task.findFirst({
              where: {
                projectId,
                assignedDeveloperId:
                  user.userId,
              },
            });

          allowed = !!task;
        }

        if (!allowed) {
          socket.emit(
            "project-access-denied",
            {
              projectId,
            }
          );

          return;
        }

        socket.join(
          `project:${projectId}`
        );
      }
    );

    socket.on(
      "leave-project",
      (projectId: number) => {
        if (
          !Number.isInteger(projectId) ||
          projectId <= 0
        ) {
          return;
        }

        socket.leave(
          `project:${projectId}`
        );
      }
    );

    socket.on("disconnect", () => {
      onlineUsers.delete(user.userId);

      io.emit("online-users", {
        count: onlineUsers.size,
      });

      console.log(
        `Socket disconnected: user ${user.userId}`
      );
    });

    console.log(
      `Socket connected: user ${user.userId}`
    );
  });
}