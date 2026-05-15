import path from "node:path";
import ejs from "ejs";
import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "../../config/logger";

type TemplateData = Record<string, unknown>;

type SendMailInput<TData extends TemplateData = TemplateData> = {
  to: string;
  template: string;
  data: TData;
  subject?: string;
  from?: string;
};

let transporter: Transporter | null = null;

const getTemplatesDirectory = () => {
  return path.join(process.cwd(), "src", "infra", "mailer", "templates");
};

const resolveTemplatePath = (template: string) => {
  if (path.isAbsolute(template) || template.includes("..")) {
    throw new Error("Invalid template path");
  }

  const templateName = template.endsWith(".ejs") ? template : `${template}.ejs`;

  return path.join(getTemplatesDirectory(), templateName);
};

const getTransporter = () => {
  if (transporter) return transporter;

  const user = process.env["MAILER_USERNAME"];
  const pass = process.env["MAILER_PASSWORD"];

  if (!user || !pass) {
    throw new Error(
      "Mail configuration missing. Set MAILER_USERNAME and MAILER_PASSWORD.",
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

export const sendMail = async <TData extends TemplateData>(
  input: SendMailInput<TData>,
) => {
  const html = await ejs.renderFile(resolveTemplatePath(input.template), {
    ...input.data,
  });

  const info = await getTransporter().sendMail({
    from:
      input.from ||
      process.env["MAILER_FROM"] ||
      "VendorProof <no-reply@vendorproof.app>",
    to: input.to,
    subject: input.subject || "VendorProof Notification",
    html,
  });

  logger.info(`Email sent to ${input.to} (messageId: ${info.messageId})`);

  return info;
};

const mailerService = {
  sendMail,
};

export default mailerService;
