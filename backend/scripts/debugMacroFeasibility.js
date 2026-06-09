import dotenv from "dotenv";
import mongoose from "mongoose";
import recipeModel from "../models/recipeModel.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  await mongoose.connect(process.env.MONGO_URL);

  const total = await recipeModel.countDocuments({});
  const nonRiceQ = {
    $and: [
      { $or: [{ isRice: { $ne: true } }, { isRice: { $exists: false } }] },
      { category: { $ne: "staple" } }
    ]
  };

  const nonRice = await recipeModel.countDocuments(nonRiceQ);
  const hp = await recipeModel.countDocuments({ ...nonRiceQ, protein: { $gte: 10 } });
  const hf = await recipeModel.countDocuments({ ...nonRiceQ, fat: { $gte: 8 } });
  const lowCarbHp = await recipeModel.countDocuments({ ...nonRiceQ, protein: { $gte: 10 }, carbs: { $lte: 14 } });
  const lowCarbHf = await recipeModel.countDocuments({ ...nonRiceQ, fat: { $gte: 8 }, carbs: { $lte: 14 } });

  const docs = await recipeModel
    .find(nonRiceQ)
    .select("name calories carbs protein fat fiber")
    .lean();

  const lowDense = docs.filter((d) => (d.calories || 0) > 0 && ((d.carbs || 0) / (d.calories || 1)) * 100 <= 8).length;

  console.log(
    JSON.stringify(
      { total, nonRice, hp, hf, lowCarbHp, lowCarbHf, lowDense },
      null,
      2
    )
  );

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
