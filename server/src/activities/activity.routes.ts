import { Router } from "express";
import { getRecentActivities } from "./activity.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();

router.get(
  "/recent",
  authenticate,
  getRecentActivities
);

export default router;