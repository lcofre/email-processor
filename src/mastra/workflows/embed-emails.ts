import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Vectors } from "@mastra/s3vectors";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import imaps from "imap-simple";
import { simpleParser, ParsedMail } from "mailparser";
import { inspect } from "util";
import { s3Config, imapConfig, appConfig } from "../../config/config";

const s3Vectors = new S3Vectors(s3Config);
const s3Client = new S3Client(s3Config.clientConfig);

async function getEmails(): Promise<(ParsedMail & { imapId: string })[]> {
    const connection = await imaps.connect(imapConfig);
    await connection.openBox('INBOX');
    const searchCriteria = ['ALL'];
    const fetchOptions = {
        bodies: ['HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE MESSAGE-ID)', 'TEXT'],
        struct: true
    };
    const messages = await connection.search(searchCriteria, fetchOptions);
    const emails: (ParsedMail & { imapId: string })[] = [];

    for (const item of messages) {
        const header = item.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE MESSAGE-ID)')?.body;
        const body = item.parts.find(part => part.which === 'TEXT')?.body;
        const imapId = `imap-${item.attributes.uid}`;

        if (header && body) {
            const email = await simpleParser(header + body);
            emails.push({ ...email, imapId });
        }
    }

    connection.end();
    return emails.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)); // Newest first
}

async function getLastEmailId(): Promise<string | undefined> {
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - (appConfig.DaysLastRun + 1));

    try {
        const queryResult = await s3Vectors.query({
            indexName: "emails",
            queryVector: new Array(1536).fill(0), // Dummy vector
            topK: 1, // We only need the newest one
            filter: {
                date: { $gte: dateFilter.getTime() }
            },
            includeMetadata: ['id', 'date']
        });

        if (queryResult.results && queryResult.results.length > 0) {
            // The results are not guaranteed to be sorted by date, so we sort them here
            const sortedResults = queryResult.results.sort((a, b) => (b.metadata?.date ?? 0) - (a.metadata?.date ?? 0));
            return sortedResults[0].metadata?.id;
        }
    } catch (e) {
        console.error("Error fetching last email ID", e);
    }
    return undefined;
}

async function embedEmails() {
    console.log("Starting email embedding workflow.");

    try {
        await s3Client.send(new GetObjectCommand({ Bucket: s3Config.vectorBucketName, Key: 'emails' }));
    } catch (error) {
        if (error.name === 'NoSuchKey') {
            await s3Vectors.createIndex({
                indexName: "emails",
                dimension: 1536, // OpenAI text-embedding-3-small
                metric: "cosine",
            });
            console.log("Index 'emails' created.");
        } else {
            console.error("Error checking for index:", error);
            return;
        }
    }

    const lastId = await getLastEmailId();
    console.log(`Last processed email ID: ${lastId}`);

    console.log("Fetching emails...");
    const emails = await getEmails();
    console.log(`Found ${emails.length} emails to process.`);

    for (const email of emails) {
        const emailId = email.imapId;

        if (emailId === lastId) {
            console.log(`Reached last processed email with ID ${emailId}. Stopping.`);
            break;
        }

        console.log(`Processing email with ID: ${emailId}`);

        const emailContent = `From: ${email.from?.text}\nTo: ${email.to?.text}\nCC: ${email.cc?.text}\nBCC: ${email.bcc?.text}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.text}`;
        const doc = MDocument.fromText(emailContent);

        const chunks = await doc.chunk({
            strategy: "recursive",
            separator: "\n\n",
        });

        if (chunks.length === 0) {
            console.log(`No chunks generated for email ${emailId}. Skipping.`);
            continue;
        }

        console.log(`Generated ${chunks.length} chunks for email ${emailId}.`);

        const { embeddings } = await embedMany({
            values: chunks.map((chunk) => chunk.text),
            model: openai.embedding("text-embedding-3-small"),
        });

        console.log(`Generated ${embeddings.length} embeddings.`);

        const metadata = chunks.map(() => ({
            id: emailId,
            date: email.date?.getTime(),
            content: emailContent,
        }));

        await s3Vectors.upsert({
            indexName: "emails",
            vectors: embeddings,
            metadata: metadata,
        });

        console.log(`Upserted ${chunks.length} vectors for email ${emailId}.`);
    }

    console.log("Email embedding workflow finished.");
}

embedEmails().catch(console.error);