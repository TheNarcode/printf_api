import { Hono } from "hono";
import database from "../database/index.js";
import { metadata } from "../database/schema.js";
import { PDFDocument } from "pdf-lib";
import { authMiddleware } from "../middlewares/auth.js";
import { maxFileSizeLimit, validMimes } from "../constants.js";
import shortUniqueId from "short-unique-id";
import { s3Client } from "../services/s3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const app = new Hono();
const sui = new shortUniqueId({ dictionary: "alpha_lower", length: 7 });

app.post("/create", async (c) => {
  // auth
  try {
    const { file } = await c.req.parseBody();

    if (
      !(file instanceof File) ||
      !validMimes.includes(file.type) ||
      file.size > maxFileSizeLimit
    ) {
      return c.status(400);
    }

    const fileId = sui.rnd();
    const arrayBuffer = await file.arrayBuffer();

    switch (file.type) {
      case "image/png":
      case "image/jpeg":
        await uploadToBucket(fileId, new Uint8Array(arrayBuffer), file, 1);
        return c.json({ fileId }, 200);
      case "application/pdf":
        const pdf = await PDFDocument.load(arrayBuffer);
        await uploadToBucket(
          fileId,
          new Uint8Array(arrayBuffer),
          file,
          pdf.getPageCount(),
        );
        return c.json({ fileId }, 200);
      default:
        return c.status(400);
    }
  } catch (e) {
    return c.status(500);
  }
});

async function uploadToBucket(
  fileId: string,
  uploadBody: Uint8Array<ArrayBufferLike>,
  file: File,
  pages: number,
) {
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: fileId,
    Body: uploadBody,
    ContentType: file.type,
    ContentLength: uploadBody.length,
  });

  await s3Client.send(command);

  await database.insert(metadata).values({
    fileId,
    type: file.type,
    name: file.name,
    pages,
  });
}

export default app;
