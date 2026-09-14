import { Router } from "express";
import {
  getDevelopers,
  getUsers,
  createUser,
  deleteUser,
} from "./user.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/role.middleware";

const router = Router();

router.get(
  "/developers",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  getDevelopers
);

router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  getUsers
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  createUser
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  deleteUser
);

export default router;