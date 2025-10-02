export const s3Config = {
    vectorBucketName: process.env.S3_VECTORS_BUCKET_NAME!,
    clientConfig: { region: process.env.AWS_REGION! },
    nonFilterableMetadataKeys: ["content"],
};

export const imapConfig = {
    imap: {
        user: process.env.IMAP_USER!,
        password: process.env.IMAP_PASSWORD!,
        host: process.env.IMAP_HOST!,
        port: 993,
        tls: true,
        authTimeout: 3000
    }
};

export const appConfig = {
    DaysLastRun: 1,
};