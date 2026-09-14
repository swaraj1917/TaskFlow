import { Router } from "express";
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
} from "./task.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/role.middleware";

const router = Router();

router.post(
  "/project/:projectId",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  createTask
);

router.get(
  "/project/:projectId",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER", "DEVELOPER"),
  getTasks
);

router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER", "DEVELOPER"),
  getTask
);

router.put(
  "/:id",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER", "DEVELOPER"),
  updateTask
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  deleteTask
);

export default router;