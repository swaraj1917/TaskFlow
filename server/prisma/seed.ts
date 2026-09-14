/// <reference types="node" />

import {
  PrismaClient,
  Role,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@taskflow.com",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const pm1 = await prisma.user.create({
    data: {
      name: "Project Manager One",
      email: "pm1@taskflow.com",
      passwordHash,
      role: Role.PROJECT_MANAGER,
    },
  });

  const pm2 = await prisma.user.create({
    data: {
      name: "Project Manager Two",
      email: "pm2@taskflow.com",
      passwordHash,
      role: Role.PROJECT_MANAGER,
    },
  });

  const developers = await Promise.all([
    prisma.user.create({
      data: {
        name: "Developer One",
        email: "dev1@taskflow.com",
        passwordHash,
        role: Role.DEVELOPER,
      },
    }),
    prisma.user.create({
      data: {
        name: "Developer Two",
        email: "dev2@taskflow.com",
        passwordHash,
        role: Role.DEVELOPER,
      },
    }),
    prisma.user.create({
      data: {
        name: "Developer Three",
        email: "dev3@taskflow.com",
        passwordHash,
        role: Role.DEVELOPER,
      },
    }),
    prisma.user.create({
      data: {
        name: "Developer Four",
        email: "dev4@taskflow.com",
        passwordHash,
        role: Role.DEVELOPER,
      },
    }),
  ]);

  const client1 = await prisma.client.create({
    data: {
      name: "Acme Client",
      email: "contact@acme.com",
      company: "Acme Corporation",
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name: "Nova Client",
      email: "contact@nova.com",
      company: "Nova Technologies",
    },
  });

  const client3 = await prisma.client.create({
    data: {
      name: "Orbit Client",
      email: "contact@orbit.com",
      company: "Orbit Solutions",
    },
  });

  const project1 = await prisma.project.create({
    data: {
      name: "Website Redesign",
      description: "Redesign the company website.",
      clientId: client1.id,
      createdById: pm1.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: "Mobile App",
      description: "Build the company's mobile application.",
      clientId: client2.id,
      createdById: pm1.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: "Analytics Dashboard",
      description: "Build an internal analytics dashboard.",
      clientId: client3.id,
      createdById: pm2.id,
    },
  });

  const now = new Date();

  const pastDate1 = new Date(now);
  pastDate1.setDate(now.getDate() - 5);

  const pastDate2 = new Date(now);
  pastDate2.setDate(now.getDate() - 2);

  const futureDate1 = new Date(now);
  futureDate1.setDate(now.getDate() + 2);

  const futureDate2 = new Date(now);
  futureDate2.setDate(now.getDate() + 5);

  const futureDate3 = new Date(now);
  futureDate3.setDate(now.getDate() + 8);

  const taskData = [
    {
      title: "Build Login Page",
      description: "Create the login interface.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1,
      isOverdue: false,
      projectId: project1.id,
      assignedDeveloperId: developers[0].id,
    },
    {
      title: "Build Dashboard",
      description: "Create the main dashboard.",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate2,
      isOverdue: false,
      projectId: project1.id,
      assignedDeveloperId: developers[1].id,
    },
    {
      title: "Create User Profile",
      description: "Build user profile functionality.",
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: futureDate3,
      isOverdue: false,
      projectId: project1.id,
      assignedDeveloperId: developers[2].id,
    },
    {
      title: "Fix Navigation",
      description: "Fix mobile navigation issues.",
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      dueDate: pastDate1,
      isOverdue: false,
      projectId: project1.id,
      assignedDeveloperId: developers[3].id,
    },
    {
      title: "Improve Homepage",
      description: "Improve homepage performance.",
      status: TaskStatus.TODO,
      priority: TaskPriority.CRITICAL,
      dueDate: pastDate2,
      isOverdue: true,
      projectId: project1.id,
      assignedDeveloperId: developers[0].id,
    },

    {
      title: "Create App Login",
      description: "Implement mobile login.",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1,
      isOverdue: false,
      projectId: project2.id,
      assignedDeveloperId: developers[1].id,
    },
    {
      title: "Build Home Screen",
      description: "Create the mobile home screen.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate2,
      isOverdue: false,
      projectId: project2.id,
      assignedDeveloperId: developers[2].id,
    },
    {
      title: "Add Push Notifications",
      description: "Implement mobile notifications.",
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: futureDate3,
      isOverdue: false,
      projectId: project2.id,
      assignedDeveloperId: developers[3].id,
    },
    {
      title: "Fix App Crash",
      description: "Fix crash during startup.",
      status: TaskStatus.DONE,
      priority: TaskPriority.CRITICAL,
      dueDate: pastDate1,
      isOverdue: false,
      projectId: project2.id,
      assignedDeveloperId: developers[0].id,
    },
    {
      title: "Optimize App Startup",
      description: "Improve startup performance.",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: pastDate2,
      isOverdue: true,
      projectId: project2.id,
      assignedDeveloperId: developers[1].id,
    },

    {
      title: "Create Analytics API",
      description: "Build analytics backend endpoints.",
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: futureDate1,
      isOverdue: false,
      projectId: project3.id,
      assignedDeveloperId: developers[2].id,
    },
    {
      title: "Build Charts",
      description: "Create dashboard charts.",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: futureDate2,
      isOverdue: false,
      projectId: project3.id,
      assignedDeveloperId: developers[3].id,
    },
    {
      title: "Add Date Filters",
      description: "Add date filtering to analytics.",
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate3,
      isOverdue: false,
      projectId: project3.id,
      assignedDeveloperId: developers[0].id,
    },
    {
      title: "Fix Report Export",
      description: "Fix CSV report export.",
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      dueDate: pastDate1,
      isOverdue: false,
      projectId: project3.id,
      assignedDeveloperId: developers[1].id,
    },
    {
      title: "Improve Dashboard Loading",
      description: "Reduce dashboard loading time.",
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: pastDate2,
      isOverdue: true,
      projectId: project3.id,
      assignedDeveloperId: developers[2].id,
    },
  ];

  const tasks = [];

  for (const data of taskData) {
    const task = await prisma.task.create({
      data,
    });

    tasks.push(task);
  }

  for (const task of tasks) {
    if (task.status !== TaskStatus.TODO) {
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          projectId: task.projectId,
          userId: task.assignedDeveloperId,
          fromStatus: TaskStatus.TODO,
          toStatus: task.status,
        },
      });
    }
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: developers[0].id,
        message: 'You were assigned task "Build Login Page"',
      },
      {
        userId: developers[1].id,
        message: 'You were assigned task "Build Dashboard"',
      },
      {
        userId: pm1.id,
        message: 'Task "Create User Profile" was moved to In Review',
      },
    ],
  });

  console.log("Seed data created successfully");
  console.log(`Admin: ${admin.email}`);
  console.log(`PMs: ${pm1.email}, ${pm2.email}`);
  console.log("Developers: dev1@taskflow.com through dev4@taskflow.com");
  console.log("Projects: 3");
  console.log("Tasks: 15");
  console.log("Overdue tasks: 3");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });