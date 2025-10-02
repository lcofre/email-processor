import { createAgent } from '@mastra/core';
import { z } from 'zod';
import { env } from '../../config';

export const categorizationAgent = createAgent({
  name: 'categorization_agent',
  description: 'Categorizes an email based on its content.',
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
    category: z.enum([
      'Spam',
      'DistributorInquiry',
      'QuoteRequestSingle',
      'QuoteRequestMulti',
      'GeneralInquiry',
    ]),
  }),
  prompt: `
    You are an email categorization agent for TrustedParts.com. Your task is to categorize incoming emails based on their content.

    Here are the categories:
    - Spam: The email is an unsolicited offer or clearly not related to TrustedParts.com's business of electronic parts.
    - DistributorInquiry: The email is from a company asking to become a participant distributor or to have their electronic parts listed on TrustedParts.com.
    - QuoteRequestSingle: The email is a request for a quote for a single electronic part.
    - QuoteRequestMulti: The email is a request for a quote for multiple electronic parts.
    - GeneralInquiry: The email is a question about TrustedParts.com that does not fall into the other categories.

    Analyze the following email and provide the appropriate category.

    Subject: {subject}
    Body: {text}
  `,
});