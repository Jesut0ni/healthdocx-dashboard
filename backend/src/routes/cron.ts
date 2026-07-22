import { Router } from "express";
import { sendReminderBatches } from "../services/reminder-delivery";

export const cronRouter = Router();

cronRouter.get("/cron/reminders", async (request, response, next) => {
  try {
    const authorization = request.header("authorization");

    if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      response.status(401).json({ success: false, error: "Unauthorized cron request." });
      return;
    }

    const sent = await sendReminderBatches({
      actor: "Vercel Cron",
      dueOnly: true,
    });

    response.json({
      success: true,
      sent,
    });
  } catch (error) {
    next(error);
  }
});
