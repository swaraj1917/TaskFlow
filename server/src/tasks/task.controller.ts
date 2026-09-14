import { Response } from "express";
import { socketServer, broadcastActivity } from "../socket";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../auth/auth.middleware";

const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  assignedDeveloperId: z.number().int().positive(),
  status: z
    .enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"])
    .optional(),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    .optional(),
  dueDate: z.string().datetime().optional(),
});

const updateTaskSchema = createTaskSchema.partial();

const taskFilterSchema = z.object({
  status: z
    .enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"])
    .optional(),

  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    .optional(),

  from: z.string().datetime().optional(),

  to: z.string().datetime().optional(),
});

function getProjectAccess(userId: number, role: string) {
  if (role === "ADMIN") {
    return {};
  }

  return {
    createdById: userId,
  };
}

export async function createTask(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const projectId = Number(req.params.projectId);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({
      message: "Invalid project ID",
    });
  }

  const result = createTaskSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid task data",
    });
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...getProjectAccess(
        req.user.userId,
        req.user.role
      ),
    },
  });

  if (!project) {
    return res.status(404).json({
      message: "Project not found",
    });
  }

  const developer = await prisma.user.findFirst({
    where: {
      id: result.data.assignedDeveloperId,
      role: "DEVELOPER",
    },
  });

  if (!developer) {
    return res.status(400).json({
      message: "Assigned user must be a developer",
    });
  }

  const task = await prisma.task.create({
    data: {
      title: result.data.title,
      description: result.data.description,
      assignedDeveloperId:
        result.data.assignedDeveloperId,
      status: result.data.status ?? "TODO",
      priority: result.data.priority ?? "MEDIUM",
      dueDate: result.data.dueDate
        ? new Date(result.data.dueDate)
        : undefined,
      projectId,
    },
  });

  const notification =
    await prisma.notification.create({
      data: {
        userId: result.data.assignedDeveloperId,
        message: `You were assigned task "${task.title}"`,
      },
    });

  const unreadCount =
    await prisma.notification.count({
      where: {
        userId: result.data.assignedDeveloperId,
        read: false,
      },
    });

  socketServer
    .to(`user:${result.data.assignedDeveloperId}`)
    .emit("notification", {
      notification,
      unreadCount,
    });

  return res.status(201).json({
    message: "Task created successfully",
    task,
  });
}

export async function getTasks(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const projectId = Number(req.params.projectId);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({
      message: "Invalid project ID",
    });
  }

  if (req.user.role === "DEVELOPER") {
    const hasAssignedTask =
      await prisma.task.findFirst({
        where: {
          projectId,
          assignedDeveloperId: req.user.userId,
        },
      });

    if (!hasAssignedTask) {
      return res.status(404).json({
        message: "Project not found",
      });
    }
  } else {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...getProjectAccess(
          req.user.userId,
          req.user.role
        ),
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }
  }

  const filters = taskFilterSchema.safeParse(
    req.query
  );

  if (!filters.success) {
    return res.status(400).json({
      message: "Invalid task filters",
    });
  }

  const where: {
    projectId: number;
    assignedDeveloperId?: number;
    status?:
      | "TODO"
      | "IN_PROGRESS"
      | "IN_REVIEW"
      | "DONE";
    priority?:
      | "LOW"
      | "MEDIUM"
      | "HIGH"
      | "CRITICAL";
    dueDate?: {
      gte?: Date;
      lte?: Date;
    };
  } = {
    projectId,
  };

  if (req.user.role === "DEVELOPER") {
    where.assignedDeveloperId =
      req.user.userId;
  }

  if (filters.data.status) {
    where.status = filters.data.status;
  }

  if (filters.data.priority) {
    where.priority = filters.data.priority;
  }

  if (filters.data.from || filters.data.to) {
    where.dueDate = {};

    if (filters.data.from) {
      where.dueDate.gte = new Date(
        filters.data.from
      );
    }

    if (filters.data.to) {
      where.dueDate.lte = new Date(
        filters.data.to
      );
    }
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignedDeveloper: {
        select: {
          id: true,
          name: true,
          email: true,
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
    tasks,
  });
}

export async function getTask(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({
      message: "Invalid task ID",
    });
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ...(req.user.role === "ADMIN"
        ? {}
        : req.user.role === "PROJECT_MANAGER"
        ? {
            project: {
              createdById: req.user.userId,
            },
          }
        : {
            assignedDeveloperId:
              req.user.userId,
          }),
    },

    include: {
      assignedDeveloper: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },

      activities: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!task) {
    return res.status(404).json({
      message: "Task not found",
    });
  }

  return res.json({
    task,
  });
}

export async function updateTask(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({
      message: "Invalid task ID",
    });
  }

  const result = updateTaskSchema.safeParse(
    req.body
  );

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid task data",
    });
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ...(req.user.role === "ADMIN"
        ? {}
        : req.user.role === "PROJECT_MANAGER"
        ? {
            project: {
              createdById: req.user.userId,
            },
          }
        : {
            assignedDeveloperId:
              req.user.userId,
          }),
    },

    include: {
      project: true,
    },
  });

  if (!task) {
    return res.status(404).json({
      message: "Task not found",
    });
  }

  if (
    req.user.role === "DEVELOPER" &&
    Object.keys(result.data).some(
      (key) => key !== "status"
    )
  ) {
    return res.status(403).json({
      message:
        "Developers can only update task status",
    });
  }

  const data: {
    title?: string;
    description?: string;
    priority?:
      | "LOW"
      | "MEDIUM"
      | "HIGH"
      | "CRITICAL";
    dueDate?: Date;
    assignedDeveloperId?: number;
    status?:
      | "TODO"
      | "IN_PROGRESS"
      | "IN_REVIEW"
      | "DONE";
  } = {};

  if (req.user.role !== "DEVELOPER") {
    if (result.data.title !== undefined) {
      data.title = result.data.title;
    }

    if (result.data.description !== undefined) {
      data.description =
        result.data.description;
    }

    if (result.data.priority !== undefined) {
      data.priority = result.data.priority;
    }

    if (result.data.dueDate !== undefined) {
      data.dueDate = new Date(
        result.data.dueDate
      );
    }

    if (
      result.data.assignedDeveloperId !==
      undefined
    ) {
      const developer =
        await prisma.user.findFirst({
          where: {
            id: result.data
              .assignedDeveloperId,
            role: "DEVELOPER",
          },
        });

      if (!developer) {
        return res.status(400).json({
          message:
            "Assigned user must be a developer",
        });
      }

      data.assignedDeveloperId =
        result.data.assignedDeveloperId;

      if (
        result.data.assignedDeveloperId !==
        task.assignedDeveloperId
      ) {
        const notification =
          await prisma.notification.create({
            data: {
              userId:
                result.data
                  .assignedDeveloperId,
              message: `You were assigned task "${task.title}"`,
            },
          });

        const unreadCount =
          await prisma.notification.count({
            where: {
              userId:
                result.data
                  .assignedDeveloperId,
              read: false,
            },
          });

        socketServer
          .to(
            `user:${result.data.assignedDeveloperId}`
          )
          .emit("notification", {
            notification,
            unreadCount,
          });
      }
    }
  }

  if (
    result.data.status &&
    result.data.status !== task.status
  ) {
    data.status = result.data.status;

    const activity = await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        projectId: task.projectId,
        userId: req.user.userId,
        fromStatus: task.status,
        toStatus: result.data.status,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    // Live update for anyone currently viewing this project's page.
    socketServer
      .to(`project:${task.projectId}`)
      .emit("task-status-updated", {
        id: activity.id,
        taskId: task.id,
        projectId: task.projectId,
        taskTitle: task.title,
        fromStatus: task.status,
        toStatus: result.data.status,
        user: activity.user,
        createdAt: activity.createdAt,
      });

    // Role-scoped dashboard-level global feed: Admin gets everything,
    // the owning PM gets it, and the assigned developer gets it,
    // regardless of whether they have the project page open.
    const finalDeveloperId =
      result.data.assignedDeveloperId ??
      task.assignedDeveloperId;

    broadcastActivity(
      {
        id: activity.id,
        taskId: task.id,
        projectId: task.projectId,
        projectName: task.project.name,
        taskTitle: task.title,
        fromStatus: task.status,
        toStatus: result.data.status,
        createdAt: activity.createdAt.toISOString(),
        user: activity.user,
      },
      task.project.createdById,
      finalDeveloperId
    );

    if (
      result.data.status === "IN_REVIEW"
    ) {
      const notification =
        await prisma.notification.create({
          data: {
            userId: task.project.createdById,
            message: `Task "${task.title}" was moved to In Review`,
          },
        });

      const unreadCount =
        await prisma.notification.count({
          where: {
            userId:
              task.project.createdById,
            read: false,
          },
        });

      socketServer
        .to(
          `user:${task.project.createdById}`
        )
        .emit("notification", {
          notification,
          unreadCount,
        });
    }
  }

  const updatedTask =
    await prisma.task.update({
      where: {
        id: taskId,
      },
      data,
    });

  return res.json({
    message: "Task updated successfully",
    task: updatedTask,
  });
}

export async function deleteTask(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const taskId = Number(req.params.id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({
      message: "Invalid task ID",
    });
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: {
        ...getProjectAccess(
          req.user.userId,
          req.user.role
        ),
      },
    },
  });

  if (!task) {
    return res.status(404).json({
      message: "Task not found",
    });
  }

  await prisma.task.delete({
    where: {
      id: taskId,
    },
  });

  return res.json({
    message: "Task deleted successfully",
  });
}