import { Hono } from "hono";
import database from "../database/index";
import { metadata } from "../database/schema";
import { PDFDocument } from "pdf-lib";
import { authMiddleware } from "../middlewares/auth";
import { maxFileSizeLimit, validMimes } from "../constants";
import shortUniqueId from "short-unique-id";
import { s3Client } from "../services/s3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const app = new Hono();
const sui = new shortUniqueId({ dictionary: "alpha_lower", length: 10 });

app.post("/create", async (c) => {
  const { file } = await c.req.parseBody();

  if (!(file instanceof File)) {
    return c.json({ message: "not a file" }, 400);
  }
  // if (!validMimes.includes(file.type)) return c.json({ message: "unsupported file" }, 400);
  // if (file.size > maxFileSizeLimit) return c.json({ message: "file size too large" }, 400);

  const fileId = `222118_${sui.rnd()}`;

  const arrayBuffer = await file.arrayBuffer();
  const fileArray = new Uint8Array(arrayBuffer);
  
  let pages = 0;
  try {
    const pdf = await PDFDocument.load(arrayBuffer);
    pages = pdf.getPageCount();
  } catch (error) {
    console.error("Invalid PDF uploaded:", error);
    return c.json({ message: "Invalid PDF file. Please ensure you are uploading a valid PDF document." }, 400);
  }

  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET,
    Key: fileId,
    Body: fileArray,
    ContentType: file.type,
    ContentLength: fileArray.length,
  });

  await s3Client.send(command);

  await database.insert(metadata).values({
    fileId,
    type: file.type,
    name: file.name,
    pages,
  });

  return c.json({ fileId });
});

export default app;