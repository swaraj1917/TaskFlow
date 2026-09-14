import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AccessTokenPayload } from "./auth.types";

const ACCESS_TOKEN_SECRET: string = process.env.ACCESS_TOKEN_SECRET ?? "";

if (!ACCESS_TOKEN_SECRET) {
  throw new Error("ACCESS_TOKEN_SECRET is not set");
}

export type AuthenticatedRequest = Request & {
  user?: AccessTokenPayload;
};

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(
      token,
      ACCESS_TOKEN_SECRET
    ) as AccessTokenPayload;

    req.user = payload;

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired access token",
    });
  }
}