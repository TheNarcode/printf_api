import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import database from "../database/index";
import { fcmTokens } from "../database/schema";
import { authMiddleware } from "../middlewares/auth";

const app = new Hono();

// POST /notification/register
// Called by the Android app on every launch / sign-in to upsert the FCM token.
// If the token already exists for this user, it's a no-op.
// If the token exists for a different user (e.g. after sign-out/sign-in),
// we update the email.
app.post(
  "/register",
  authMiddleware,
  zValidator("json", z.object({ token: z.string().min(1) })),
  async (c) => {
    const { token } = c.req.valid("json");
    const payload = c.get("payload");
    const email = payload.email!;

    // Check if this token already exists
    const existing = await database.query.fcmTokens.findFirst({
      where: eq(fcmTokens.token, token),
    });

    if (existing) {
      // Token exists — update email if it changed (device switched accounts)
      if (existing.email !== email) {
        await database
          .update(fcmTokens)
          .set({ email })
          .where(eq(fcmTokens.token, token));
      }
      return c.json({ message: "token registered" });
    }

    // New token — insert
    await database.insert(fcmTokens).values({ email, token });

    return c.json({ message: "token registered" });
  },
);

export default app;
