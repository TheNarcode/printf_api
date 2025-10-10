import { Hono } from "hono";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../services/s3.js";
import db from "../database/index.js";
import { metadata } from "../database/schema.js";
import { extractMetadataAndPages } from "pdf-metadata";
import { authMiddleware } from "../middlewares/auth.js";
import { maxFileSizeLimit, validMimes } from "../constants.js";

const app = new Hono();

app.post("/upload", authMiddleware, async (c) => {
  const { file } = await c.req.parseBody();

  if (!(file instanceof File)) return c.text("not a file", 200);
  if (!validMimes.includes(file.type)) return c.text("unsupported file", 200);
  if (file.size > maxFileSizeLimit) return c.text("file size too large", 200);

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const fileId = `${crypto.randomUUID()}`;
  const { pages } = await extractMetadataAndPages(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: fileId,
    Body: uint8Array,
    ContentType: file.type,
    ContentLength: uint8Array.length,
  });

  const result = await s3Client.send(command);

  if (result.$metadata.httpStatusCode != 200)
    return c.json({ message: "failed" }, 500);

  await db.insert(metadata).values({
    fileId,
    type: file.type,
    name: file.name,
    pages,
  });

  return c.json({ file: fileId });
});

export default app;
