import { Hono } from "hono";
import db from "../database/index";
import { metadata } from "../database/schema";
import { PDFDocument } from "pdf-lib";
import { authMiddleware } from "../middlewares/auth";
import { maxFileSizeLimit, validMimes } from "../constants";
import shortUniqueId from "short-unique-id";

const app = new Hono<{ Bindings: Env }>();
const sui = new shortUniqueId({ dictionary: "alpha_lower", length: 7 });

app.post("/create", authMiddleware, async (c) => {
  try {
    const database = db(c.env.PRINTFDB);
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
        await c.env.PRINTFBUCKET.put(fileId, arrayBuffer);
        await database.insert(metadata).values({
          fileId,
          type: file.type,
          name: file.name,
          pages: 1,
        });
        return c.json({ fileId }, 200);
      case "application/pdf":
        const pdf = await PDFDocument.load(arrayBuffer);
        await c.env.PRINTFBUCKET.put(fileId, arrayBuffer);

        await database.insert(metadata).values({
          fileId,
          type: file.type,
          name: file.name,
          pages: pdf.getPageCount(),
        });

        return c.json({ fileId }, 200);
      default:
        return c.status(400);
    }
  } catch (e) {
    return c.status(500);
  }
});

export default app;
