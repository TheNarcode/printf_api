import admin from "firebase-admin";
import path from "path";
import { readFileSync } from "fs";

// Initialize Firebase Admin SDK with the service account key file.
// The key file lives next to package.json in the server root.
if (!admin.apps.length) {
  const keyPath = path.resolve(
    import.meta.dir,
    "../../printf-fcm-firebase-adminsdk-fbsvc-5af6a0b042.json",
  );
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export { admin };
