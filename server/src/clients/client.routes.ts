import { Router } from "express";
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} from "./client.controller";
import { authenticate } from "../auth/auth.middleware";
import { authorize } from "../auth/role.middleware";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  getClients
);

router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "PROJECT_MANAGER"),
  getClient
);

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  createClient
);

router.put(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  updateClient
);

router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  deleteClient
);

export default router;