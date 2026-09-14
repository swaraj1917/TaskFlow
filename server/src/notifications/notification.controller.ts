import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../auth/auth.middleware";

export async function getNotifications(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.user.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  const unreadCount = await prisma.notification.count({
    where: {
      userId: req.user.userId,
      read: false,
    },
  });

  return res.json({
    notifications,
    unreadCount,
  });
}

export async function markNotificationRead(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const notificationId = Number(req.params.id);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({
      message: "Invalid notification ID",
    });
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: req.user.userId,
    },
  });

  if (!notification) {
    return res.status(404).json({
      message: "Notification not found",
    });
  }

  const updated = await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      read: true,
    },
  });

  return res.json({
    message: "Notification marked as read",
    notification: updated,
  });
}

export async function markAllNotificationsRead(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  await prisma.notification.updateMany({
    where: {
      userId: req.user.userId,
      read: false,
    },
    data: {
      read: true,
    },
  });

  return res.json({
    message: "All notifications marked as read",
  });
}