import "dotenv/config";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { connectDatabase, sequelize } from "./sequelize.js";
import { PasswordResetRequest, User } from "../models/index.js";

/**
 * Sets an account's password from the server console, for when nobody can
 * approve the request (e.g. the only super admin forgot theirs). Signs the
 * account out everywhere. Run: npm run admin:reset-password -- <email>
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run admin:reset-password -- <email>");
    process.exit(1);
  }
  let password = process.env.NEW_PASSWORD ?? "";
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("New password (12+ characters): ");
    rl.close();
  }
  if (password.length < 12) {
    console.error("The password must be at least 12 characters");
    process.exit(1);
  }

  await connectDatabase();
  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`No account with the email ${email}`);
    process.exit(1);
  }
  user.passwordHash = await bcrypt.hash(password, 12);
  user.tokenVersion += 1;
  await user.save();
  await PasswordResetRequest.update({ status: "replaced", decidedAt: new Date() }, { where: { userId: user.id, status: "pending" } });
  console.log(`Password changed for ${email}. They're signed out everywhere and can sign in with the new password.`);
  await sequelize.close();
}

main().catch((err) => {
  console.error("Password reset failed:", err);
  process.exit(1);
});
