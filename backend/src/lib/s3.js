import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({});
const BUCKET = process.env.ARTIFACTS_BUCKET;

export async function uploadJson(key, data) {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
    }));
}

export async function uploadText(key, content, contentType = 'text/plain') {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: content,
        ContentType: contentType,
    }));
}

export async function getJson(key) {
    try {
        const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        const body = await result.Body.transformToString();
        return JSON.parse(body);
    } catch (err) {
        if (err.name === 'NoSuchKey') return null;
        throw err;
    }
}

export async function getText(key) {
    try {
        const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        return await result.Body.transformToString();
    } catch (err) {
        if (err.name === 'NoSuchKey') return null;
        throw err;
    }
}

export async function listObjects(prefix) {
    const result = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
    }));
    return (result.Contents || []).map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
    }));
}

export async function objectExists(key) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return true;
    } catch {
        return false;
    }
}
