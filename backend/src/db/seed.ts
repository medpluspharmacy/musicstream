import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDatabase, sequelize } from "./sequelize.js";
import { User } from "../models/index.js";

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables are required");
    process.exit(1);
  }

  await connectDatabase();

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists, skipping`);
  } else {
    await User.create({
      name: "Administrator",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "super_admin",
      approvalStatus: "approved",
    });
    console.log(`Created admin ${email}`);
  }

  await sequelize.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
