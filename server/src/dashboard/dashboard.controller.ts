import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../auth/auth.middleware";
import { getOnlineUserCount } from "../socket";

export async function getDashboard(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (req.user.role === "ADMIN") {
    const totalProjects = await prisma.project.count();

    const tasksByStatus = await prisma.task.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    });

    const overdueCount = await prisma.task.count({
      where: {
        isOverdue: true,
      },
    });

    return res.json({
      role: "ADMIN",
      totalProjects,
      tasksByStatus: tasksByStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      overdueCount,
      onlineUsers: getOnlineUserCount(),
    });
  }

  if (req.user.role === "PROJECT_MANAGER") {
    const projects = await prisma.project.findMany({
      where: {
        createdById: req.user.userId,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const tasksByPriority = await prisma.task.groupBy({
      by: ["priority"],
      where: {
        project: {
          createdById: req.user.userId,
        },
      },
      _count: {
        _all: true,
      },
    });

    const now = new Date();
    const endOfWeek = new Date(now);

    endOfWeek.setDate(
      now.getDate() + (7 - now.getDay())
    );

    endOfWeek.setHours(23, 59, 59, 999);

    const upcomingDueDates =
      await prisma.task.findMany({
        where: {
          project: {
            createdById: req.user.userId,
          },
          dueDate: {
            gte: now,
            lte: endOfWeek,
          },
          status: {
            not: "DONE",
          },
        },
        select: {
          id: true,
          title: true,
          priority: true,
          dueDate: true,
          projectId: true,
        },
        orderBy: {
          dueDate: "asc",
        },
      });

    return res.json({
      role: "PROJECT_MANAGER",
      projects,
      tasksByPriority: tasksByPriority.map(
        (item) => ({
          priority: item.priority,
          count: item._count._all,
        })
      ),
      upcomingDueDates,
    });
  }

  const tasks = await prisma.task.findMany({
    where: {
      assignedDeveloperId: req.user.userId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      {
        priority: "desc",
      },
      {
        dueDate: "asc",
      },
    ],
  });

  return res.json({
    role: "DEVELOPER",
    tasks,
  });
}