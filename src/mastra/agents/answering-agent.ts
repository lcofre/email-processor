import { createAgent } from '@mastra/core';
import { z } from 'zod';
import { env } from '../../config';

export const answeringAgent = createAgent({
  name: 'answering_agent',
  description: 'Generates a draft response to a general inquiry email.',
  llm: {
    provider: 'openai',
    model: env.OPENAI_MODEL,
    apiKey: env.OPENAI_API_KEY,
  },
  input: z.object({
    subject: z.string(),
    text: z.string(),
  }),
  output: z.object({
    response: z.string(),
  }),
  prompt: `
    You are a helpful assistant for TrustedParts.com.
    Your task is to write a draft response to the following email.
    The response should be professional and helpful.

    Subject: {subject}
    Body: {text}

    Draft your response below:
  `,
});