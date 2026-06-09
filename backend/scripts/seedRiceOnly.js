import mongoose from "mongoose";
import dotenv from "dotenv";
import recipeModel from "../models/recipeModel.js";

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/food-delivery";

const riceSeedData = [
  {
    name: "Cơm Trắng 50g",
    description: "Khẩu phần cơm rất nhỏ (50g gạo tẻ) phù hợp meal plan cho 1 người, ưu tiên kiểm soát carbs",
    category: "staple",
    cookingMethod: "luoc",
    dietType: "vegan",
    calories: 130,
    protein: 2.8,
    carbs: 28,
    fat: 0.3,
    fiber: 0.3,
    ingredients: ["50g gạo tẻ", "110ml nước", "1 nhúm muối (optional)"],
    instructions: [
      "Vo gạo sạch 2-3 lần",
      "Ngâm gạo 15 phút (optional)",
      "Cho gạo và nước vào nồi cơm điện (tỷ lệ 1:2)",
      "Nấu chế độ cơm trắng (~25 phút)",
      "Để cơm rest 10 phút trước khi xới"
    ],
    preparationTime: 5,
    cookingTime: 25,
    servings: 1,
    difficulty: "easy",
    allergens: [],
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600",
    tags: ["staple", "basic", "everyday", "very-low-portion"],
    isPopular: true,
    season: ["all-season"],
    isRice: true,
    riceAmount: "50g",
    cholesterol: 0,
    omega3: 0.1,
    water: 70,
    saturatedFat: 0.1,
    sodium: 273
  },
  {
    name: "Cơm Trắng 75g",
    description: "Khẩu phần cơm nhỏ (75g gạo tẻ) cho bữa chính cá nhân, cân bằng năng lượng tốt hơn",
    category: "staple",
    cookingMethod: "luoc",
    dietType: "vegan",
    calories: 195,
    protein: 4.1,
    carbs: 42,
    fat: 0.4,
    fiber: 0.4,
    ingredients: ["75g gạo tẻ", "160ml nước", "1 nhúm muối (optional)"],
    instructions: [
      "Vo gạo sạch 2-3 lần",
      "Ngâm gạo 15 phút (optional)",
      "Cho gạo và nước vào nồi cơm điện (tỷ lệ 1:2)",
      "Nấu chế độ cơm trắng (~25 phút)",
      "Để cơm rest 10 phút trước khi xới"
    ],
    preparationTime: 5,
    cookingTime: 25,
    servings: 1,
    difficulty: "easy",
    allergens: [],
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600",
    tags: ["staple", "basic", "everyday", "low-portion"],
    isPopular: true,
    season: ["all-season"],
    isRice: true,
    riceAmount: "75g",
    cholesterol: 0,
    omega3: 0.1,
    water: 106,
    saturatedFat: 0.2,
    sodium: 359
  },
  {
    name: "Cơm Trắng 100g",
    description: "Khẩu phần cơm vừa (100g gạo tẻ) cho bữa chính khi cần thêm năng lượng",
    category: "staple",
    cookingMethod: "luoc",
    dietType: "vegan",
    calories: 260,
    protein: 5.5,
    carbs: 56,
    fat: 0.5,
    fiber: 0.6,
    ingredients: ["100g gạo tẻ", "210ml nước", "1 nhúm muối (optional)"],
    instructions: [
      "Vo gạo sạch 2-3 lần",
      "Ngâm gạo 15 phút (optional)",
      "Cho gạo và nước vào nồi cơm điện (tỷ lệ 1:2)",
      "Nấu chế độ cơm trắng (~25 phút)",
      "Để cơm rest 10 phút trước khi xới"
    ],
    preparationTime: 5,
    cookingTime: 25,
    servings: 1,
    difficulty: "easy",
    allergens: [],
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600",
    tags: ["staple", "basic", "everyday", "medium-portion"],
    isPopular: true,
    season: ["all-season"],
    isRice: true,
    riceAmount: "100g",
    cholesterol: 0,
    omega3: 0.2,
    water: 141,
    saturatedFat: 0.2,
    sodium: 546
  }
];

async function connectDB() {
  await mongoose.connect(MONGO_URL);
  console.log("DB Connected");
}

function pickRiceRecipes() {
  return riceSeedData;
}

function buildUpdatePayload(recipe) {
  const {
    name,
    description,
    category,
    cookingMethod,
    dietType,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    ingredients,
    instructions,
    preparationTime,
    cookingTime,
    servings,
    difficulty,
    allergens,
    tags,
    isPopular,
    season,
    isRice,
    riceAmount,
    cholesterol,
    omega3,
    water,
    saturatedFat,
    sodium
  } = recipe;

  return {
    name,
    description,
    category,
    cookingMethod,
    dietType,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    ingredients,
    instructions,
    preparationTime,
    cookingTime,
    servings,
    difficulty,
    allergens,
    tags,
    isPopular,
    season,
    isRice,
    riceAmount,
    cholesterol,
    omega3,
    water,
    saturatedFat,
    sodium
  };
}

async function upsertRiceRecipes() {
  const riceRecipes = pickRiceRecipes();
  if (!riceRecipes.length) {
    console.log("No rice recipes found in source data.");
    return;
  }

  let inserted = 0;
  let updated = 0;

  for (const rice of riceRecipes) {
    const query = { name: rice.name };
    const existing = await recipeModel.findOne(query).select("_id image").lean();

    const updateDoc = {
      $set: buildUpdatePayload(rice),
      // Preserve existing image if recipe already exists with a custom image.
      $setOnInsert: { image: rice.image || "" }
    };

    if (!existing) {
      await recipeModel.updateOne(query, updateDoc, { upsert: true });
      inserted += 1;
      continue;
    }

    // Keep existing image untouched on update.
    await recipeModel.updateOne(query, { $set: buildUpdatePayload(rice) });
    updated += 1;
  }

  console.log(`Rice seed completed: inserted=${inserted}, updated=${updated}, total=${riceRecipes.length}`);
}

async function main() {
  try {
    await connectDB();
    await upsertRiceRecipes();
    await mongoose.connection.close();
    console.log("DB connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Rice seed failed:", error);
    process.exit(1);
  }
}

main();
