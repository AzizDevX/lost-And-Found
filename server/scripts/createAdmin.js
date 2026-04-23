#!/usr/bin/env node
/**
 * ─── Create Admin — Terminal Script ──────────────────────────────────────────
 *
 * Usage:
 *   node scripts/createAdmin.js
 *
 * Or with args (non-interactive):
 *   node scripts/createAdmin.js --username admin1 --email admin@ted-university.com --password Secret123! --role moderator
 *
 * Roles: superadmin | moderator (default: moderator)
 *
 * Requires MONGO_URI in your .env (or environment).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import readline from "readline";
import { parseArgs } from "util";
import { connectDB } from "../config/Connect_database.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
}); // ─── Helpers ──────────────────────────────────────────────────────────────────

function ask(rl, question, hidden = false) {
  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      let input = "";
      process.stdin.on("data", function handler(char) {
        char = char.toString();
        if (char === "\n" || char === "\r" || char === "\u0003") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", handler);
          process.stdout.write("\n");
          resolve(input);
        } else if (char === "\u007F") {
          input = input.slice(0, -1);
        } else {
          input += char;
          process.stdout.write("*");
        }
      });
    } else {
      rl.question(question, resolve);
    }
  });
}

function validateEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function validatePassword(password) {
  // Min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(username);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Parse optional CLI flags
  let cliArgs = {};
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        username: { type: "string" },
        email: { type: "string" },
        password: { type: "string" },
        role: { type: "string" },
      },
      strict: false,
    });
    cliArgs = values;
  } catch {
    // ignore parse errors, fall back to interactive
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n╔══════════════════════════════════╗");
  console.log("║     Lost & Found — Create Admin  ║");
  console.log("╚══════════════════════════════════╝\n");

  // ── Collect inputs ────────────────────────────────────────────────────────

  let username = cliArgs.username?.trim();
  if (!username) {
    username = (await ask(rl, "Username (3-50 chars, a-z 0-9 _ -): ")).trim();
  }
  if (!validateUsername(username)) {
    console.error(
      "✖  Invalid username. Use 3-50 alphanumeric/underscore/dash chars.",
    );
    rl.close();
    process.exit(1);
  }

  let email = cliArgs.email?.trim().toLowerCase();
  if (!email) {
    email = (await ask(rl, "Email: ")).trim().toLowerCase();
  }
  if (!validateEmail(email)) {
    console.error("✖  Invalid email address.");
    rl.close();
    process.exit(1);
  }

  let password = cliArgs.password;
  if (!password) {
    password = await ask(
      rl,
      "Password (min 8, uppercase + digit required): ",
      true,
    );
  }
  if (!validatePassword(password)) {
    console.error(
      "✖  Weak password. Need 8+ chars with uppercase, lowercase, and a digit.",
    );
    rl.close();
    process.exit(1);
  }

  let role = cliArgs.role?.trim().toLowerCase();
  if (!role) {
    const raw = (
      await ask(rl, "Role [moderator/superadmin] (default: moderator): ")
    )
      .trim()
      .toLowerCase();
    role = raw || "moderator";
  }
  if (!["superadmin", "moderator"].includes(role)) {
    console.error("✖  Invalid role. Choose 'moderator' or 'superadmin'.");
    rl.close();
    process.exit(1);
  }

  rl.close();

  // ── Connect to DB ─────────────────────────────────────────────────────────

  console.log("\nConnecting to database...");
  await connectDB();
  console.log("✔  Connected.\n");

  // ── Dynamically import model (ESM safe) ───────────────────────────────────

  const { default: Admin } = await import("../models/admin.model.js");

  // ── Check for duplicates ──────────────────────────────────────────────────

  const existingEmail = await Admin.findOne({ email });
  if (existingEmail) {
    console.error(`✖  An admin with email '${email}' already exists.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const existingUsername = await Admin.findOne({ username });
  if (existingUsername) {
    console.error(`✖  An admin with username '${username}' already exists.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── Hash & save ───────────────────────────────────────────────────────────

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await Admin.create({
    username,
    email,
    password: hashedPassword,
    role,
    createdBy: "CLI",
  });

  console.log("✔  Admin created successfully!");
  console.log(`   ID       : ${admin._id}`);
  console.log(`   Username : ${admin.username}`);
  console.log(`   Email    : ${admin.email}`);
  console.log(`   Role     : ${admin.role}`);
  console.log(`   Created  : ${admin.createdAt.toISOString()}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("✖  Fatal error:", err.message);
  process.exit(1);
});
