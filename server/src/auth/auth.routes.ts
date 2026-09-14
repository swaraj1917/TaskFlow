import { Router } from "express";
import { authorize } from "./role.middleware";
import { login, refresh, register } from "./auth.controller";
import {
  authenticate,
  AuthenticatedRequest,
} from "./auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

router.get(
  "/me",
  authenticate,
  (req: AuthenticatedRequest, res) => {
  res.json({
    message: "Authenticated successfully",
    user: req.user,
  });
});

export default router;