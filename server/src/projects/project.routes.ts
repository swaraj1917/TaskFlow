import { Router } from "express";
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from "./project.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/role.middleware";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  getProjects
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  createProject
);

router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  getProjectById
);

router.put(
  "/:id",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  updateProject
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  deleteProject
);

export default router;