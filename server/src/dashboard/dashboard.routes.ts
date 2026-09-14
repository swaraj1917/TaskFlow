import { Router } from "express";
import { getDashboard } from "./dashboard.controller";
import { authenticate } from "../auth/auth.middleware";

const router = Router();

router.get("/", authenticate, getDashboard);

export default router;