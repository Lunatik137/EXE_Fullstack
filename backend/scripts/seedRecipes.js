import mongoose from "mongoose";
import recipeModel from "../models/recipeModel.js";
import { veganRecipes } from "../data/veganRecipes.js";
import dotenv from "dotenv";

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27017/food-delivery");
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

// Seed recipes function
const seedRecipes = async () => {
  try {
    console.log("🌱 Starting recipe seeding process...");

    // Clear existing recipes
    const deleteResult = await recipeModel.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing recipes`);

    // Insert recipes (cookingMethod already assigned in veganRecipes.js)
    const insertResult = await recipeModel.insertMany(veganRecipes);
    console.log(`✅ Successfully inserted ${insertResult.length} recipes`);

    // Show statistics
    const breakfastCount = await recipeModel.countDocuments({ category: "breakfast" });
    const lunchCount = await recipeModel.countDocuments({ category: "lunch" });
    const dinnerCount = await recipeModel.countDocuments({ category: "dinner" });
    const popularCount = await recipeModel.countDocuments({ isPopular: true });
    
    // Show cooking method statistics
    const xaoCount = await recipeModel.countDocuments({ cookingMethod: "xao" });
    const luocCount = await recipeModel.countDocuments({ cookingMethod: "luoc" });
    const nuongCount = await recipeModel.countDocuments({ cookingMethod: "nuong" });
    const khoCount = await recipeModel.countDocuments({ cookingMethod: "kho" });
    const canhCount = await recipeModel.countDocuments({ cookingMethod: "canh" });
    const tronCount = await recipeModel.countDocuments({ cookingMethod: "tron" });
    const hapCount = await recipeModel.countDocuments({ cookingMethod: "hap" });
    const chienCount = await recipeModel.countDocuments({ cookingMethod: "chien" });

    console.log("\n📊 Recipe Statistics:");
    console.log(`   Breakfast: ${breakfastCount} recipes`);
    console.log(`   Lunch: ${lunchCount} recipes`);
    console.log(`   Dinner: ${dinnerCount} recipes`);
    console.log(`   Popular: ${popularCount} recipes`);
    console.log(`   Total: ${breakfastCount + lunchCount + dinnerCount} recipes`);
    
    console.log("\n🍳 Cooking Methods:");
    console.log(`   Xào (Stir-fry): ${xaoCount}`);
    console.log(`   Luộc (Boil): ${luocCount}`);
    console.log(`   Nướng (Grill): ${nuongCount}`);
    console.log(`   Kho (Braise): ${khoCount}`);
    console.log(`   Canh (Soup): ${canhCount}`);
    console.log(`   Trộn (Mix): ${tronCount}`);
    console.log(`   Hấp (Steam): ${hapCount}`);
    console.log(`   Chiên (Fry): ${chienCount}`);

    console.log("\n✨ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding recipes:", error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await seedRecipes();
    
    console.log("\n👋 Closing database connection...");
    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
};

// Run the script
main();
