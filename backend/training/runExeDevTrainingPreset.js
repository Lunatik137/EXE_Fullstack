import dotenv from "dotenv";
import mongoose from "mongoose";
import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../config/db.js";
import userModel from "../models/userModel.js";

dotenv.config();

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const [key, value] = item.slice(2).split("=");
    args[key] = value === undefined ? true : value;
  }
  return args;
}

async function resolveTrainingUserId(explicitUserId) {
  if (explicitUserId) return explicitUserId;
  if (process.env.TRAINING_USER_ID) return process.env.TRAINING_USER_ID;

  await connectDB();
  const user = await userModel.findOne({}, { _id: 1 }).sort({ createdAt: 1 }).lean();
  await mongoose.connection.close();

  if (!user?._id) {
    throw new Error("No user found in EXE_dev. Set TRAINING_USER_ID in .env or create a user first.");
  }

  return String(user._id);
}

async function runPreset() {
  const args = parseArgs(process.argv.slice(2));
  const userId = await resolveTrainingUserId(args.userId);

  const presetArgs = {
    userId,
    batchSize: "20",
    delayMs: "800",
    interBatchDelayMs: "20000",
    forceAIGenerate: "true",
    ...args
  };

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const runnerPath = resolve(currentDir, "mealPlanTrainingRunner.js");
  const backendDir = resolve(currentDir, "..");

  const cliArgs = Object.entries(presetArgs).map(([key, value]) => `--${key}=${value}`);

  const child = spawn(process.execPath, [runnerPath, ...cliArgs], {
    cwd: backendDir,
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", code => {
    process.exit(code ?? 0);
  });

  child.on("error", error => {
    console.error("Failed to start EXE_dev training preset:", error.message);
    process.exit(1);
  });
}

runPreset().catch(error => {
  console.error("EXE_dev training preset failed:", error.message);
  process.exit(1);
});