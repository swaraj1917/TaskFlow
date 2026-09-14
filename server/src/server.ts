import "dotenv/config";
import userRoutes from "./users/user.routes";
import dashboardRoutes from "./dashboard/dashboard.routes";
import { startOverdueJob } from "./jobs/overdue.job";
import activityRoutes from "./activities/activity.routes";
import notificationRoutes from "./notifications/notification.routes";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";

import authRoutes from "./auth/auth.routes";
import clientRoutes from "./clients/client.routes";
import projectRoutes from "./projects/project.routes";
import taskRoutes from "./tasks/task.routes";
import { setupSocket } from "./socket";

const app = express();
const httpServer = http.createServer(app);

// Comma-separated list, e.g. "https://taskflow.vercel.app,http://localhost:5173"
const allowedOrigins = (
  process.env.CLIENT_URL ?? "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim());

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

setupSocket(io);

const PORT = Number(process.env.PORT) || 5000;

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ message: "TaskFlow API is running!" });
});

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);

// 404 for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler: catches anything thrown/rejected in a route
// (including async handlers, which Express 5 forwards automatically)
// and returns a consistent structured JSON error instead of ever
// leaking a raw stack trace to the client.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    console.error(err);

    res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
);

startOverdueJob();

httpServer.listen(PORT, () => {
  console.log(`TaskFlow server running on http://localhost:${PORT}`);
});