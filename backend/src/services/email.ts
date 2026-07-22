import { request as httpsRequest } from "node:https";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

type ReminderTask = {
  id: string;
  title: string;
  project: string;
  due: string;
  priority: string;
  status: string;
};

export type EmailDeliveryResult =
  | { status: "sent"; detail: string }
  | { status: "not_configured"; detail: string }
  | { status: "failed"; detail: string };

type MailerooConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  apiUrl: string;
};

type MailerooResponse = {
  success?: boolean;
  message?: string;
  data?: {
    reference_id?: string;
  };
};

type MailerooPayload = {
  from: {
    address: string;
    display_name: string;
  };
  to: {
    address: string;
    display_name: string;
  };
  subject: string;
  plain: string;
  html: string;
  tracking: boolean;
  tags: Record<string, string>;
};

let transporter: Transporter | undefined;

function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] ?? character;
  });
}

function getMailerooConfig(): MailerooConfig | null {
  const apiKey = process.env.MAILEROO_API_KEY;
  const fromEmail = process.env.MAILEROO_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return null;
  }

  return {
    apiKey,
    fromEmail,
    fromName: process.env.MAILEROO_FROM_NAME ?? "HealthDocX",
    apiUrl: process.env.MAILEROO_API_URL ?? "https://smtp.maileroo.com/api/v2/emails",
  };
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user,
      pass,
    },
    from,
  };
}

function getTransporter() {
  const config = getSmtpConfig();

  if (!config) {
    return null;
  }

  transporter ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return {
    transporter,
    from: config.from,
  };
}

function buildReminderText(ownerName: string, tasks: ReminderTask[]) {
  const lines = tasks.map(
    (task) => `- ${task.id}: ${task.title} (${task.project}) / ${task.priority} / ${task.status} / due ${task.due}`,
  );

  return [
    `Hi ${ownerName},`,
    "",
    `You have ${tasks.length} pending HealthDocX task${tasks.length === 1 ? "" : "s"}:`,
    "",
    ...lines,
    "",
    `Open the dashboard: ${process.env.APP_BASE_URL ?? "http://localhost:3000"}`,
  ].join("\n");
}

function buildReminderHtml(ownerName: string, tasks: ReminderTask[]) {
  const taskItems = tasks
    .map(
      (task) =>
        `<li><strong>${escapeHtml(task.id)}</strong>: ${escapeHtml(task.title)}<br/><span>${escapeHtml(task.project)} / ${escapeHtml(task.priority)} / ${escapeHtml(task.status)} / due ${escapeHtml(task.due)}</span></li>`,
    )
    .join("");
  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  return `
    <div style="font-family:Arial,sans-serif;color:#07160F;line-height:1.5">
      <p>Hi ${escapeHtml(ownerName)},</p>
      <p>You have ${tasks.length} pending HealthDocX task${tasks.length === 1 ? "" : "s"}:</p>
      <ul>${taskItems}</ul>
      <p><a href="${escapeHtml(appBaseUrl)}">Open the dashboard</a></p>
    </div>
  `;
}

function parseMailerooResponse(rawBody: string): MailerooResponse {
  try {
    const parsed = JSON.parse(rawBody) as unknown;

    if (parsed && typeof parsed === "object") {
      return parsed as MailerooResponse;
    }
  } catch {
    return {
      message: rawBody.slice(0, 300),
    };
  }

  return {};
}

function postMailerooEmail(config: MailerooConfig, payload: MailerooPayload) {
  return new Promise<{ statusCode: number; body: MailerooResponse }>((resolve, reject) => {
    const requestBody = JSON.stringify(payload);
    const endpoint = new URL(config.apiUrl);
    const request = httpsRequest(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody).toString(),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");

          resolve({
            statusCode: response.statusCode ?? 0,
            body: parseMailerooResponse(rawBody),
          });
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error("Maileroo request timed out."));
    });
    request.write(requestBody);
    request.end();
  });
}

async function sendMailerooReminderEmail({
  config,
  to,
  ownerName,
  tasks,
}: {
  config: MailerooConfig;
  to: string;
  ownerName: string;
  tasks: ReminderTask[];
}): Promise<EmailDeliveryResult> {
  const subject = `HealthDocX reminder: ${tasks.length} pending task${tasks.length === 1 ? "" : "s"}`;

  try {
    const response = await postMailerooEmail(config, {
      from: {
        address: config.fromEmail,
        display_name: config.fromName,
      },
      to: {
        address: to,
        display_name: ownerName,
      },
      subject,
      plain: buildReminderText(ownerName, tasks),
      html: buildReminderHtml(ownerName, tasks),
      tracking: false,
      tags: {
        app: "healthdocx-dashboard",
        type: "task-reminder",
      },
    });
    const responseMessage = response.body.message ? `: ${response.body.message}` : ".";

    if (response.statusCode < 200 || response.statusCode >= 300 || response.body.success === false) {
      return {
        status: "failed",
        detail: `Maileroo rejected the email${responseMessage}`,
      };
    }

    const referenceId = response.body.data?.reference_id;

    return {
      status: "sent",
      detail: referenceId
        ? `Email sent through Maileroo with reference ${referenceId}.`
        : "Email sent through Maileroo.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Maileroo error.";

    return {
      status: "failed",
      detail: `Maileroo email failed: ${message}`,
    };
  }
}

export async function sendReminderEmail({
  to,
  ownerName,
  tasks,
}: {
  to: string;
  ownerName: string;
  tasks: ReminderTask[];
}): Promise<EmailDeliveryResult> {
  const mailerooConfig = getMailerooConfig();

  if (mailerooConfig) {
    return sendMailerooReminderEmail({
      config: mailerooConfig,
      to,
      ownerName,
      tasks,
    });
  }

  const mailer = getTransporter();

  if (!mailer) {
    return {
      status: "not_configured",
      detail: "Maileroo or SMTP is not configured, so no email was sent.",
    };
  }

  const info = await mailer.transporter.sendMail({
    from: mailer.from,
    to,
    subject: `HealthDocX reminder: ${tasks.length} pending task${tasks.length === 1 ? "" : "s"}`,
    text: buildReminderText(ownerName, tasks),
    html: buildReminderHtml(ownerName, tasks),
  });

  return {
    status: "sent",
    detail: `Email sent with message id ${info.messageId}.`,
  };
}
