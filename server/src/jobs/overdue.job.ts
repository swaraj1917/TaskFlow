import cron from "node-cron";
import prisma from "../lib/prisma";

export function startOverdueJob() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await prisma.task.updateMany({
        where: {
          dueDate: {
            lt: new Date(),
          },
          isOverdue: false,
          status: {
            not: "DONE",
          },
        },
        data: {
          isOverdue: true,
        },
      });

      if (result.count > 0) {
        console.log(`Marked ${result.count} task(s) as overdue`);
      }
    } catch (error) {
      console.error("Overdue job failed:", error);
    }
  });

  console.log("Overdue job started");
}