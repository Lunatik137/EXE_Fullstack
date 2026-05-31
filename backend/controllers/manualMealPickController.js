import mongoose from "mongoose";
import manualMealPickModel from "../models/manualMealPickModel.js";
import recipeModel from "../models/recipeModel.js";

const ALLOWED_MEAL_TYPES = ["breakfast", "lunch", "dinner"];

const normalizeVietnameseText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isWhiteRiceRecipeName = (name = "") =>
  normalizeVietnameseText(name).includes("com trang");

const parseInputDate = (dateInput) => {
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateInput);
};

const toDateKey = (dateInput) => {
  const date = parseInputDate(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateStart = (dateInput) => {
  const date = parseInputDate(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const mapPickToResponse = (pickDoc) => {
  const picks = pickDoc?.picks || {};

  const toRecipeIdString = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return String(value._id || value);
  };

  const toRecipeIdArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(v => (typeof v === "string" ? v : String(v._id || v)));
  };

  return {
    dateKey: pickDoc?.dateKey || "",
    source: pickDoc?.source || "free-tier",
    picks: {
      breakfast: toRecipeIdString(picks.breakfast),
      lunch: toRecipeIdArray(picks.lunch),
      dinner: toRecipeIdArray(picks.dinner)
    }
  };
};

const getManualMealPickByDate = async (req, res) => {
  try {
    const userId = req.userId || req.body?.userId;
    const { date } = req.body || {};

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    const dateKey = toDateKey(date);
    if (!dateKey) {
      return res.json({ success: false, message: "Invalid date" });
    }

    const manualPick = await manualMealPickModel.findOne({ userId, dateKey });

    if (!manualPick) {
      return res.json({
        success: true,
        manualPick: {
          dateKey,
          source: "free-tier",
          picks: { breakfast: "", lunch: [], dinner: [] }
        }
      });
    }

    return res.json({ success: true, manualPick: mapPickToResponse(manualPick) });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Error fetching manual meal picks" });
  }
};

const saveManualMealPick = async (req, res) => {
  try {
    const userId = req.userId || req.body?.userId;
    const { date, mealType, recipeId, recipeIds, source } = req.body || {};

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    if (!ALLOWED_MEAL_TYPES.includes(mealType)) {
      return res.json({ success: false, message: "Invalid meal type" });
    }

    const dateKey = toDateKey(date);
    const dateStart = toDateStart(date);

    if (!dateKey || !dateStart) {
      return res.json({ success: false, message: "Invalid date" });
    }

    // Determine which format we're using: recipeId (old/breakfast) or recipeIds (new/multi)
    const inputIds = mealType === "breakfast" 
      ? (recipeId ? [recipeId] : [])
      : (Array.isArray(recipeIds) ? recipeIds : (recipeIds ? [recipeIds] : []));

    // Validate and process recipe IDs
    const validRecipeIds = [];
    let riceCount = 0;
    let nonRiceCount = 0;

    if (inputIds.length > 0) {
      for (const id of inputIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.json({ success: false, message: "Invalid recipe ID" });
        }

        const recipe = await recipeModel.findById(id).select("name isFree");
        if (!recipe) {
          return res.json({ success: false, message: "Recipe not found" });
        }

        if (mealType === "lunch" || mealType === "dinner") {
          if (isWhiteRiceRecipeName(recipe.name)) riceCount++;
          else nonRiceCount++;
        }

        const isAllowedRecipe = recipe.isFree || isWhiteRiceRecipeName(recipe.name);
        if (!isAllowedRecipe) {
          return res.json({
            success: false,
            message: "Recipe is not available for manual free-style picking"
          });
        }

        validRecipeIds.push(recipe._id);
      }
    }

    if (mealType === "lunch" || mealType === "dinner") {
      if (nonRiceCount > 5) {
        return res.json({
          success: false,
          message: "Tối đa 5 món khác nhau cho bữa này"
        });
      }

      if (riceCount > 1) {
        return res.json({
          success: false,
          message: "Tối đa 1 cơm trắng cho bữa này"
        });
      }
    }

    // Build the update object based on meal type
    const update = {
      userId,
      dateKey,
      date: dateStart,
      source: source === "premium-future-manual" ? "premium-future-manual" : "free-tier"
    };

    if (mealType === "breakfast") {
      update[`picks.breakfast`] = validRecipeIds.length > 0 ? validRecipeIds[0] : null;
    } else {
      update[`picks.${mealType}`] = validRecipeIds;
    }

    const manualPick = await manualMealPickModel.findOneAndUpdate(
      { userId, dateKey },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: "Manual meal pick saved",
      manualPick: mapPickToResponse(manualPick)
    });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Error saving manual meal pick" });
  }
};

export { getManualMealPickByDate, saveManualMealPick };
