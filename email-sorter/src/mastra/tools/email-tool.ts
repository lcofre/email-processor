import { createTool } from '@mastra/core';
import { z } from 'zod';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { env } from '../../config';

const config = {
  imap: {
    user: env.IMAP_USERNAME,
    password: env.IMAP_PASSWORD,
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    tls: true,
    authTimeout: 3000,
  },
};

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: true,
  auth: {
    user: env.IMAP_USERNAME,
    pass: env.IMAP_PASSWORD,
  },
});

async function connect() {
  return imaps.connect(config);
}

export const emailTool = createTool({
  name: 'email_tool',
  description: 'A tool for interacting with emails.',
  input: z.object({}),
  run: async () => {},
});

export const fetchUnreadEmails = emailTool.action({
  name: 'fetch_unread_emails',
  description: 'Fetches unread emails from the inbox.',
  input: z.object({}),
  run: async function* () {
    const connection = await connect();
    await connection.openBox('INBOX');
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false,
    };
    const messages = await connection.search(searchCriteria, fetchOptions);

    for (const item of messages) {
      const all = item.parts.find(part => part.which === 'TEXT');
      const id = item.attributes.uid;
      const idHeader = 'uid: ' + id + '\r\n';
      const mail = await simpleParser(idHeader + all?.body);
      yield { ...mail, uid: id };
    }

    await connection.end();
  },
});

export const moveEmail = emailTool.action({
  name: 'move_email',
  description: 'Moves an email to a specified folder.',
  input: z.object({
    uid: z.number(),
    folder: z.string(),
  }),
  run: async ({ uid, folder }) => {
    const connection = await connect();
    await connection.openBox('INBOX');
    await connection.move(uid, folder);
    await connection.end();
  },
});

export const createDraft = emailTool.action({
  name: 'create_draft',
  description: 'Creates a draft email.',
  input: z.object({
    to: z.string(),
    subject: z.string(),
    text: z.string(),
  }),
  run: async ({ to, subject, text }) => {
    const mailOptions = {
      from: env.IMAP_USERNAME,
      to,
      subject,
      text,
    };

    const message = `From: ${mailOptions.from}\nTo: ${mailOptions.to}\nSubject: ${mailOptions.subject}\n\n${mailOptions.text}`;
    const connection = await connect();
    // The folder name for drafts can vary, e.g., '[Gmail]/Drafts' for Gmail
    await connection.append(message, { mailbox: 'Drafts' });
    await connection.end();
  },
});