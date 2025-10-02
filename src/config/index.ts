import { z } from 'zod';

export const env = z
  .object({
    IMAP_HOST: z.string().default('imap.mail.yahoo.com'),
    IMAP_PORT: z.coerce.number().default(993),
    IMAP_USERNAME: z.string(),
    IMAP_PASSWORD: z.string(),
    SMTP_HOST: z.string().default('smtp.mail.yahoo.com'),
    SMTP_PORT: z.coerce.number().default(465),
    OPENAI_API_KEY: z.string(),
    OPENAI_MODEL: z.string().default('gpt-4'),
  })
  .parse(process.env);