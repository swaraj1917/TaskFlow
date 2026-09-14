import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../auth/auth.middleware";

const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  clientId: z.number().int().positive(),
});

const updateProjectSchema =
  createProjectSchema.partial();

function projectAccess(userId: number, role: string) {
  if (role === "ADMIN") {
    return {};
  }

  return {
    createdById: userId,
  };
}

export async function createProject(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const result = createProjectSchema.safeParse(
    req.body
  );

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid project data",
    });
  }

  const client = await prisma.client.findUnique({
    where: {
      id: result.data.clientId,
    },
  });

  if (!client) {
    return res.status(400).json({
      message: "Client not found",
    });
  }

  const project = await prisma.project.create({
    data: {
      name: result.data.name,
      description: result.data.description,
      clientId: result.data.clientId,
      createdById: req.user.userId,
    },
    include: {
      client: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  return res.status(201).json({
    message: "Project created successfully",
    project,
  });
}

export async function getProjects(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const projects = await prisma.project.findMany({
    where: {
      ...projectAccess(
        req.user.userId,
        req.user.role
      ),
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
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

  return res.json({
    projects,
  });
}

export async function getProjectById(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid project ID",
    });
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      ...projectAccess(
        req.user.userId,
        req.user.role
      ),
    },
    include: {
      client: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  if (!project) {
    return res.status(404).json({
      message: "Project not found",
    });
  }

  return res.json({
    project,
  });
}

export async function updateProject(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid project ID",
    });
  }

  const result = updateProjectSchema.safeParse(
    req.body
  );

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid project data",
    });
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      ...projectAccess(
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

  if (result.data.clientId !== undefined) {
    const client = await prisma.client.findUnique({
      where: {
        id: result.data.clientId,
      },
    });

    if (!client) {
      return res.status(400).json({
        message: "Client not found",
      });
    }
  }

  const updated = await prisma.project.update({
    where: {
      id,
    },
    data: result.data,
    include: {
      client: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  return res.json({
    message: "Project updated successfully",
    project: updated,
  });
}

export async function deleteProject(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid project ID",
    });
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      ...projectAccess(
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

  await prisma.project.delete({
    where: {
      id,
    },
  });

  return res.json({
    message: "Project deleted successfully",
  });
}