import { createWorkflow } from '@mastra/core';
import { z } from 'zod';
import { fetchUnreadEmails, moveEmail, createDraft } from '../tools/email-tool';
import { categorizationAgent } from '../agents/categorization-agent';
import { answeringAgent } from '../agents/answering-agent';

export const emailProcessingWorkflow = createWorkflow({
  name: 'email_processing_workflow',
  description: 'A workflow to process incoming emails.',
  input: z.object({}),
  run: async function* ({}) {
    for await (const email of fetchUnreadEmails.run({})) {
      if (!email.subject || !email.text || !email.from?.value[0]?.address) {
        continue;
      }

      const { category } = await categorizationAgent.run({
        subject: email.subject,
        text: email.text,
      });

      yield { email: email.subject, category };

      switch (category) {
        case 'Spam':
          await moveEmail.run({ uid: email.uid, folder: 'Deleted' });
          break;
        case 'DistributorInquiry':
          await moveEmail.run({
            uid: email.uid,
            folder: 'Distributor Participation Inquiries',
          });
          break;
        case 'QuoteRequestSingle':
          await createDraft.run({
            to: email.from.value[0].address,
            subject: `Re: ${email.subject}`,
            text: 'Thank you for your request for a single part. We will get back to you shortly with a quote.',
          });
          break;
        case 'QuoteRequestMulti':
          await createDraft.run({
            to: email.from.value[0].address,
            subject: `Re: ${email.subject}`,
            text: 'Thank you for your request for multiple parts. Our team will review your request and get back to you with a quote.',
          });
          break;
        case 'GeneralInquiry':
          const { response } = await answeringAgent.run({
            subject: email.subject,
            text: email.text,
          });
          await createDraft.run({
            to: email.from.value[0].address,
            subject: `Re: ${email.subject}`,
            text: response,
          });
          break;
      }
    }
  },
});