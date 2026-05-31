import dotenv from "dotenv";
import mongoose from "mongoose";
import recipeModel from "../models/recipeModel.js";

dotenv.config();

const FREE_NON_RICE_LIMIT = 10;

const normalizeVietnameseText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isWhiteRiceRecipeName = (name = "") =>
  normalizeVietnameseText(name).includes("com trang");

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("DB Connected");
};

const setFreeRecipes = async () => {
  console.log("Resetting all recipe isFree flags to false...");
  await recipeModel.updateMany({}, { $set: { isFree: false } });

  const allRecipes = await recipeModel.find({}).sort({ isPopular: -1, createdAt: -1 });

  const whiteRiceRecipes = allRecipes.filter((recipe) => isWhiteRiceRecipeName(recipe.name));
  const nonRiceCandidates = allRecipes.filter((recipe) => !isWhiteRiceRecipeName(recipe.name));

  const topFreeNonRice = nonRiceCandidates.slice(0, FREE_NON_RICE_LIMIT);

  const freeRecipeIds = [
    ...topFreeNonRice.map((recipe) => recipe._id),
    ...whiteRiceRecipes.map((recipe) => recipe._id)
  ];

  await recipeModel.updateMany(
    { _id: { $in: freeRecipeIds } },
    { $set: { isFree: true } }
  );

  console.log(`Marked ${topFreeNonRice.length} non-rice recipes as free.`);
  console.log(`Marked ${whiteRiceRecipes.length} white-rice recipes as free.`);

  const freeRecipes = await recipeModel.find({ isFree: true }).select("name isFree");
  console.log(`Total free recipes: ${freeRecipes.length}`);
  freeRecipes.forEach((recipe) => console.log(` - ${recipe.name}`));
};

const main = async () => {
  try {
    await connectDB();
    await setFreeRecipes();
  } catch (error) {
    console.error("Failed to set free recipes:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();
