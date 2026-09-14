import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../auth/auth.middleware";

const querySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

export async function getRecentActivities(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const result = querySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid activity query",
    });
  }

  const { projectId, limit } = result.data;

  const where: any = {};

  if (projectId) {
    if (req.user.role === "ADMIN") {
      where.projectId = projectId;
    } else if (req.user.role === "PROJECT_MANAGER") {
      where.project = {
        createdById: req.user.userId,
      };
      where.projectId = projectId;
    } else {
      where.projectId = projectId;
      where.task = {
        assignedDeveloperId: req.user.userId,
      };
    }
  } else if (req.user.role === "PROJECT_MANAGER") {
    where.project = {
      createdById: req.user.userId,
    };
  } else if (req.user.role === "DEVELOPER") {
    where.task = {
      assignedDeveloperId: req.user.userId,
    };
  }

  const activities = await prisma.taskActivity.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          assignedDeveloperId: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return res.json({
    activities,
  });
}