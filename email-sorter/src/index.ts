import { emailProcessingWorkflow } from './mastra/workflows/email-processing-workflow';

async function main() {
  console.log('Starting email processing workflow...');
  try {
    for await (const result of emailProcessingWorkflow.run({})) {
      console.log('Workflow progress:', result);
    }
    console.log('Email processing workflow finished.');
  } catch (error) {
    console.error('An error occurred during the workflow execution:', error);
  }
}

main();