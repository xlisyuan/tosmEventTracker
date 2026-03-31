const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const bcrypt = require("bcryptjs");

admin.initializeApp();
const db = admin.firestore();

const CONFIG_PATH = "saConfig/main";

async function getConfig() {
  const snap = await db.doc(CONFIG_PATH).get();
  if (!snap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "saConfig/main not found. Please create config first."
    );
  }
  return snap.data();
}

exports.verifySaPassword = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const inputPassword = request.data?.password;
  if (typeof inputPassword !== "string" || inputPassword.length === 0) {
    throw new HttpsError("invalid-argument", "Password is required.");
  }

  const config = await getConfig();
  if (config.enabled === false) {
    throw new HttpsError("permission-denied", "SA page is disabled.");
  }
  if (!config.passwordHash || typeof config.passwordHash !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "passwordHash is missing in saConfig/main."
    );
  }

  const isValid = await bcrypt.compare(inputPassword, config.passwordHash);
  if (!isValid) {
    throw new HttpsError("permission-denied", "Invalid password.");
  }

  await db.doc(`saSessions/${request.auth.uid}`).set(
    {
      verified: true,
      version: Number(config.version || 1),
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});

exports.getSaSessionStatus = onCall(async (request) => {
  if (!request.auth?.uid) {
    return { verified: false };
  }
  const [configSnap, sessionSnap] = await Promise.all([
    db.doc(CONFIG_PATH).get(),
    db.doc(`saSessions/${request.auth.uid}`).get(),
  ]);
  if (!configSnap.exists || !sessionSnap.exists) {
    return { verified: false };
  }

  const config = configSnap.data();
  const session = sessionSnap.data();
  const verified =
    config?.enabled !== false &&
    session?.verified === true &&
    Number(session?.version || 0) === Number(config?.version || 1);

  return { verified };
});
