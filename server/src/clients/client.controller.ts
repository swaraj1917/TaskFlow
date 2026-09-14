import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../auth/auth.middleware";

const clientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  company: z.string().min(2).optional(),
});

export async function getClients(
  _req: AuthenticatedRequest,
  res: Response
) {
  const clients = await prisma.client.findMany({
    include: {
      _count: {
        select: {
          projects: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return res.json({
    clients,
  });
}

export async function getClient(
  req: AuthenticatedRequest,
  res: Response
) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid client ID",
    });
  }

  const client = await prisma.client.findUnique({
    where: {
      id,
    },
    include: {
      projects: {
        select: {
          id: true,
          name: true,
          createdById: true,
        },
      },
    },
  });

  if (!client) {
    return res.status(404).json({
      message: "Client not found",
    });
  }

  return res.json({
    client,
  });
}

export async function createClient(
  req: AuthenticatedRequest,
  res: Response
) {
  const result = clientSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid client data",
    });
  }

  const client = await prisma.client.create({
    data: result.data,
  });

  return res.status(201).json({
    message: "Client created successfully",
    client,
  });
}

export async function updateClient(
  req: AuthenticatedRequest,
  res: Response
) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid client ID",
    });
  }

  const result = clientSchema.partial().safeParse(
    req.body
  );

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid client data",
    });
  }

  const client = await prisma.client.findUnique({
    where: {
      id,
    },
  });

  if (!client) {
    return res.status(404).json({
      message: "Client not found",
    });
  }

  const updated = await prisma.client.update({
    where: {
      id,
    },
    data: result.data,
  });

  return res.json({
    message: "Client updated successfully",
    client: updated,
  });
}

export async function deleteClient(
  req: AuthenticatedRequest,
  res: Response
) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid client ID",
    });
  }

  const client = await prisma.client.findUnique({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          projects: true,
        },
      },
    },
  });

  if (!client) {
    return res.status(404).json({
      message: "Client not found",
    });
  }

  if (client._count.projects > 0) {
    return res.status(409).json({
      message:
        "Cannot delete a client that has projects",
    });
  }

  await prisma.client.delete({
    where: {
      id,
    },
  });

  return res.json({
    message: "Client deleted successfully",
  });
}