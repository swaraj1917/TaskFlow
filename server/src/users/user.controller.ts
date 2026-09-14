import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { hashPassword } from "../auth/auth.utils";
import { AuthenticatedRequest } from "../auth/auth.middleware";

export async function getDevelopers(
  _req: AuthenticatedRequest,
  res: Response
) {
  const developers = await prisma.user.findMany({
    where: {
      role: "DEVELOPER",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return res.json({ developers });
}

export async function getUsers(
  _req: AuthenticatedRequest,
  res: Response
) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.json({ users });
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "PROJECT_MANAGER", "DEVELOPER"]),
});

export async function createUser(
  req: AuthenticatedRequest,
  res: Response
) {
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid user data",
    });
  }

  const { name, email, password, role } = result.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.status(409).json({
      message: "Email is already registered",
    });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return res.status(201).json({ user });
}

export async function deleteUser(
  req: AuthenticatedRequest,
  res: Response
) {
  const id = Number(req.params.id);

  if (req.user && id === req.user.userId) {
    return res.status(400).json({
      message: "You cannot delete your own account",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  await prisma.user.delete({ where: { id } });

  return res.json({ message: "User deleted" });
}