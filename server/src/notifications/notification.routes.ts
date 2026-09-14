import { Router } from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notification.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();

router.get("/", authenticate, getNotifications);

router.patch(
  "/:id/read",
  authenticate,
  markNotificationRead
);

router.patch(
  "/read-all",
  authenticate,
  markAllNotificationsRead
);

export default router;