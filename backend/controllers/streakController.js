import MealPlan from "../models/mealPlanModel.js";
import Streak from "../models/streakModel.js";
import userModel from "../models/userModel.js";
import { notifyStreakEncouragement } from "./notificationController.js";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const MEAL_KEYS = ["breakfast", "lunch", "dinner"];
const DEFAULT_MEAL_TIMES = {
  breakfast: "07:00",
  lunch: "11:30",
  dinner: "18:30",
};
const EARLY_CONFIRMATION_MINUTES = 60;

function getZonedParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function toDateKey(partsOrDate = new Date()) {
  const parts = partsOrDate instanceof Date ? getZonedParts(partsOrDate) : partsOrDate;
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function parseTimeToMinutes(value) {
  if (!value || typeof value !== "string" || !value.includes(":")) {
    return null;
  }

  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function minutesToTimeString(totalMinutes) {
  const normalized = Math.max(0, Math.min(1439, totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getMealSchedule(user) {
  const reminderSettings = user?.mealReminderSettings || {};
  return {
    breakfast: reminderSettings.breakfastTime || DEFAULT_MEAL_TIMES.breakfast,
    lunch: reminderSettings.lunchTime || DEFAULT_MEAL_TIMES.lunch,
    dinner: reminderSettings.dinnerTime || DEFAULT_MEAL_TIMES.dinner,
  };
}

function hasMealContent(day, mealKey) {
  const meal = day?.[mealKey];
  if (!meal) {
    return false;
  }

  if (mealKey === "breakfast") {
    return Boolean(
      (Array.isArray(meal.items) && meal.items.length > 0) || // new combo format
      meal.name || meal.recipeId                              // legacy single-recipe format
    );
  }

  return Boolean((Array.isArray(meal.items) && meal.items.length > 0) || meal.name || meal.recipeId);
}

function getMealRecord(streak, dateKey) {
  return streak.mealRecords.find((record) => record.dateKey === dateKey);
}

function getOrCreateMealRecord(streak, dateKey, mealPlanId) {
  let record = getMealRecord(streak, dateKey);
  if (!record) {
    streak.mealRecords.push({
      dateKey,
      mealPlanId,
      meals: {
        breakfast: {},
        lunch: {},
        dinner: {},
      },
    });
    // Return the actual Mongoose subdocument (not the original plain object)
    record = streak.mealRecords[streak.mealRecords.length - 1];
  } else if (mealPlanId && !record.mealPlanId) {
    record.mealPlanId = mealPlanId;
  }

  return record;
}

function buildEligibleDayMap(mealPlans) {
  const eligibleDayMap = new Map();

  for (const mealPlan of mealPlans) {
    for (const day of mealPlan.days || []) {
      if (!day?.date) {
        continue;
      }

      const dateKey = toDateKey(new Date(day.date));
      const availableMeals = MEAL_KEYS.filter((mealKey) => hasMealContent(day, mealKey));

      if (!availableMeals.length) {
        continue;
      }

      eligibleDayMap.set(dateKey, {
        dateKey,
        mealPlanId: mealPlan._id,
        availableMeals,
        requiredMeals: Math.min(2, availableMeals.length),
      });
    }
  }

  return eligibleDayMap;
}

function getMealWindow(scheduleTime, confirmationWindowMinutes) {
  const scheduledMinutes = parseTimeToMinutes(scheduleTime);
  const baseMinutes = scheduledMinutes ?? 0;
  const startMinutes = Math.max(0, baseMinutes - EARLY_CONFIRMATION_MINUTES);
  const endMinutes = Math.min(1439, baseMinutes + confirmationWindowMinutes);

  return {
    scheduledTime: scheduleTime,
    startMinutes,
    endMinutes,
    windowStart: minutesToTimeString(startMinutes),
    windowEnd: minutesToTimeString(endMinutes),
  };
}

function countConfirmedMeals(record, availableMeals) {
  if (!record) {
    return 0;
  }

  return availableMeals.filter((mealKey) => Boolean(record.meals?.[mealKey]?.confirmedAt)).length;
}

function isDayClosed(dateKey, eligibleDay, schedule, confirmationWindowMinutes, nowDateKey, nowMinutes) {
  if (!eligibleDay) {
    return false;
  }

  if (dateKey < nowDateKey) {
    return true;
  }

  if (dateKey > nowDateKey) {
    return false;
  }

  const latestWindowEnd = eligibleDay.availableMeals.reduce((maxMinutes, mealKey) => {
    const mealWindow = getMealWindow(schedule[mealKey], confirmationWindowMinutes);
    return Math.max(maxMinutes, mealWindow.endMinutes);
  }, 0);

  return nowMinutes > latestWindowEnd;
}

function computeDayStatus({ dateKey, streak, eligibleDay, recoveredDates, schedule, confirmationWindowMinutes, nowDateKey, nowMinutes }) {
  const record = getMealRecord(streak, dateKey);
  const confirmedMeals = countConfirmedMeals(record, eligibleDay.availableMeals);
  const recovered = recoveredDates.has(dateKey);
  const qualifiedByMeals = confirmedMeals >= eligibleDay.requiredMeals;
  const qualified = qualifiedByMeals || recovered;
  const closed = isDayClosed(dateKey, eligibleDay, schedule, confirmationWindowMinutes, nowDateKey, nowMinutes);

  return {
    dateKey,
    confirmedMeals,
    requiredMeals: eligibleDay.requiredMeals,
    availableMeals: eligibleDay.availableMeals,
    recovered,
    qualifiedByMeals,
    qualified,
    closed,
    record,
  };
}

function buildHistory({ streak, eligibleDayMap, schedule, confirmationWindowMinutes, nowDateKey, nowMinutes }) {
  const recoveredDates = new Set(streak.recoveredDates || []);

  return Array.from(eligibleDayMap.keys())
    .sort((left, right) => left.localeCompare(right))
    .slice(-7)
    .reverse()
    .map((dateKey) => {
      const eligibleDay = eligibleDayMap.get(dateKey);
      return computeDayStatus({
        dateKey,
        streak,
        eligibleDay,
        recoveredDates,
        schedule,
        confirmationWindowMinutes,
        nowDateKey,
        nowMinutes,
      });
    });
}

function computeSummary({ streak, eligibleDayMap, schedule, confirmationWindowMinutes, nowDateKey, nowMinutes }) {
  const recoveredDates = new Set(streak.recoveredDates || []);
  const sortedDates = Array.from(eligibleDayMap.keys()).sort((left, right) => left.localeCompare(right));

  let currentStreak = 0;
  let longestStreak = 0;
  let lastQualifiedDateKey = null;
  let lastMissedDateKey = null;

  for (const dateKey of sortedDates) {
    const eligibleDay = eligibleDayMap.get(dateKey);
    const dayStatus = computeDayStatus({
      dateKey,
      streak,
      eligibleDay,
      recoveredDates,
      schedule,
      confirmationWindowMinutes,
      nowDateKey,
      nowMinutes,
    });

    if (dayStatus.qualified) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      lastQualifiedDateKey = dateKey;
      continue;
    }

    if (dayStatus.closed) {
      currentStreak = 0;
      lastMissedDateKey = dateKey;
    }
  }

  return {
    currentStreak,
    longestStreak,
    lastQualifiedDateKey,
    lastMissedDateKey,
  };
}

function syncSummary(streak, summary) {
  streak.stats.currentStreak = summary.currentStreak;
  streak.stats.longestStreak = summary.longestStreak;
  streak.stats.lastQualifiedDateKey = summary.lastQualifiedDateKey;
  streak.stats.lastMissedDateKey = summary.lastMissedDateKey;
}

function buildMealStatuses({ streak, eligibleDay, dateKey, schedule, confirmationWindowMinutes, nowDateKey, nowMinutes }) {
  const mealRecord = getMealRecord(streak, dateKey);
  const availableMeals = new Set(eligibleDay?.availableMeals || []);

  return MEAL_KEYS.reduce((accumulator, mealKey) => {
    const mealWindow = getMealWindow(schedule[mealKey], confirmationWindowMinutes);
    const confirmedAt = mealRecord?.meals?.[mealKey]?.confirmedAt || null;
    const available = availableMeals.has(mealKey);

    let canConfirm = false;
    let disabledReason = "";

    if (!available) {
      disabledReason = "Bữa này không có trong lộ trình hiện tại";
    } else if (confirmedAt) {
      disabledReason = "Bạn đã xác nhận bữa này rồi";
    } else if (dateKey !== nowDateKey) {
      disabledReason = "Chỉ được xác nhận trong đúng ngày diễn ra bữa ăn";
    } else if (nowMinutes < mealWindow.startMinutes) {
      disabledReason = `Bạn có thể xác nhận từ ${mealWindow.windowStart}`;
    } else if (nowMinutes > mealWindow.endMinutes) {
      disabledReason = `Đã hết hạn xác nhận lúc ${mealWindow.windowEnd}`;
    } else {
      canConfirm = true;
    }

    accumulator[mealKey] = {
      available,
      confirmed: Boolean(confirmedAt),
      confirmedAt,
      canConfirm,
      disabledReason,
      scheduledTime: schedule[mealKey],
      windowStart: mealWindow.windowStart,
      windowEnd: mealWindow.windowEnd,
    };

    return accumulator;
  }, {});
}

function buildStatusPayload({ user, streak, eligibleDayMap }) {
  const nowParts = getZonedParts(new Date());
  const nowDateKey = toDateKey(nowParts);
  const nowMinutes = (nowParts.hour * 60) + nowParts.minute;
  const schedule = getMealSchedule(user);
  const confirmationWindowMinutes = streak.settings?.confirmationWindowMinutes || 180;
  const todayEligibleDay = eligibleDayMap.get(nowDateKey) || null;
  const summary = computeSummary({
    streak,
    eligibleDayMap,
    schedule,
    confirmationWindowMinutes,
    nowDateKey,
    nowMinutes,
  });

  syncSummary(streak, summary);

  const todayStatus = todayEligibleDay
    ? computeDayStatus({
        dateKey: nowDateKey,
        streak,
        eligibleDay: todayEligibleDay,
        recoveredDates: new Set(streak.recoveredDates || []),
        schedule,
        confirmationWindowMinutes,
        nowDateKey,
        nowMinutes,
      })
    : {
        dateKey: nowDateKey,
        confirmedMeals: 0,
        requiredMeals: 2,
        availableMeals: [],
        recovered: false,
        qualifiedByMeals: false,
        qualified: false,
        closed: false,
      };

  const currentMonthKey = nowDateKey.slice(0, 7);
  const usedRecoveryThisMonth = (streak.recoveryUsage || []).some((item) => item.monthKey === currentMonthKey);

  const recoverableDateKey = Array.from(eligibleDayMap.keys())
    .sort((left, right) => right.localeCompare(left))
    .find((dateKey) => {
      const dayStatus = computeDayStatus({
        dateKey,
        streak,
        eligibleDay: eligibleDayMap.get(dateKey),
        recoveredDates: new Set(streak.recoveredDates || []),
        schedule,
        confirmationWindowMinutes,
        nowDateKey,
        nowMinutes,
      });

      return dateKey < nowDateKey && dayStatus.closed && !dayStatus.qualified;
    }) || null;

  return {
    todayDateKey: nowDateKey,
    currentStreak: summary.currentStreak,
    longestStreak: summary.longestStreak,
    lastQualifiedDateKey: summary.lastQualifiedDateKey,
    lastMissedDateKey: summary.lastMissedDateKey,
    todayProgress: {
      dateKey: todayStatus.dateKey,
      confirmedMeals: todayStatus.confirmedMeals,
      requiredMeals: todayStatus.requiredMeals,
      qualified: todayStatus.qualified,
      closed: todayStatus.closed,
    },
    settings: {
      confirmationWindowMinutes,
      earlyConfirmationMinutes: EARLY_CONFIRMATION_MINUTES,
    },
    meals: buildMealStatuses({
      streak,
      eligibleDay: todayEligibleDay,
      dateKey: nowDateKey,
      schedule,
      confirmationWindowMinutes,
      nowDateKey,
      nowMinutes,
    }),
    recovery: {
      usedThisMonth: usedRecoveryThisMonth,
      remainingThisMonth: usedRecoveryThisMonth ? 0 : 1,
      recoverableDateKey,
      usageHistory: (streak.recoveryUsage || []).slice(-3).reverse(),
    },
    history: buildHistory({
      streak,
      eligibleDayMap,
      schedule,
      confirmationWindowMinutes,
      nowDateKey,
      nowMinutes,
    }),
    schedule,
  };
}

async function loadContext(userId) {
  const [user, mealPlans, existingStreak] = await Promise.all([
    userModel.findById(userId).select("mealReminderSettings"),
    MealPlan.find({ userId, status: { $in: ["active", "completed"] } }).select("_id days status").sort({ startDate: 1, createdAt: 1 }),
    Streak.findOne({ userId }),
  ]);

  if (!user) {
    return { user: null, mealPlans: [], streak: null, eligibleDayMap: new Map() };
  }

  const streak = existingStreak || new Streak({ userId });
  const eligibleDayMap = buildEligibleDayMap(mealPlans);

  return { user, mealPlans, streak, eligibleDayMap };
}

const getStreakStatus = async (req, res) => {
  try {
    const { userId } = req.body;
    const { user, streak, eligibleDayMap } = await loadContext(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const status = buildStatusPayload({ user, streak, eligibleDayMap });
    await streak.save();

    return res.json({ success: true, streak: status });
  } catch (error) {
    console.error("Error fetching streak status:", error);
    return res.json({ success: false, message: "Error fetching streak status" });
  }
};

const confirmMealCompletion = async (req, res) => {
  try {
    const { userId, mealType } = req.body;

    if (!MEAL_KEYS.includes(mealType)) {
      return res.json({ success: false, message: "Loại bữa ăn không hợp lệ" });
    }

    const { user, streak, eligibleDayMap } = await loadContext(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const nowDateKey = toDateKey(new Date());
    const todayEligibleDay = eligibleDayMap.get(nowDateKey);

    if (!todayEligibleDay || !todayEligibleDay.availableMeals.includes(mealType)) {
      return res.json({ success: false, message: "Bữa ăn này không có trong lộ trình hôm nay" });
    }

    const statusBeforeUpdate = buildStatusPayload({ user, streak, eligibleDayMap });
    const mealStatus = statusBeforeUpdate.meals?.[mealType];

    if (!mealStatus?.available) {
      return res.json({ success: false, message: "Bữa ăn này hiện không khả dụng" });
    }

    if (mealStatus.confirmed) {
      return res.json({
        success: true,
        message: "Bữa ăn đã được xác nhận trước đó",
        streak: statusBeforeUpdate,
      });
    }

    if (!mealStatus.canConfirm) {
      return res.json({ success: false, message: mealStatus.disabledReason || "Chưa thể xác nhận bữa ăn này" });
    }

    const mealRecord = getOrCreateMealRecord(streak, nowDateKey, todayEligibleDay.mealPlanId);
    mealRecord.meals[mealType] = {
      ...(mealRecord.meals?.[mealType] || {}),
      confirmedAt: new Date(),
    };

    // Explicitly mark the nested array path to avoid stale first-response state.
    streak.markModified("mealRecords");
    await streak.save();

    const updatedStatus = buildStatusPayload({ user, streak, eligibleDayMap });
    await streak.save();

    const qualifiedToday = updatedStatus.todayProgress.qualified;
    const prevQualified = statusBeforeUpdate.todayProgress?.qualified || false;

    // Send streak encouragement when user first qualifies today
    if (qualifiedToday && !prevQualified && updatedStatus.currentStreak >= 3) {
      notifyStreakEncouragement(userId, updatedStatus.currentStreak).catch(err =>
        console.error('Error sending streak encouragement:', err)
      );
    }

    return res.json({
      success: true,
      message: qualifiedToday
        ? "Bạn đã đủ 2/3 bữa hôm nay, chuỗi được duy trì"
        : "Đã xác nhận hoàn thành bữa ăn",
      streak: updatedStatus,
    });
  } catch (error) {
    console.error("Error confirming meal completion:", error);
    return res.json({ success: false, message: "Error confirming meal completion" });
  }
};

const updateStreakSettings = async (req, res) => {
  try {
    const { userId, confirmationWindowMinutes } = req.body;
    const normalizedWindow = Number(confirmationWindowMinutes);

    if (!Number.isFinite(normalizedWindow) || normalizedWindow < 30 || normalizedWindow > 720) {
      return res.json({ success: false, message: "Thời gian xác nhận phải nằm trong khoảng 30 đến 720 phút" });
    }

    const { user, streak, eligibleDayMap } = await loadContext(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    streak.settings.confirmationWindowMinutes = Math.round(normalizedWindow);
    const status = buildStatusPayload({ user, streak, eligibleDayMap });
    await streak.save();

    return res.json({ success: true, message: "Đã cập nhật thời gian xác nhận bữa ăn", streak: status });
  } catch (error) {
    console.error("Error updating streak settings:", error);
    return res.json({ success: false, message: "Error updating streak settings" });
  }
};

const recoverStreak = async (req, res) => {
  try {
    const { userId } = req.body;
    const { user, streak, eligibleDayMap } = await loadContext(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const currentStatus = buildStatusPayload({ user, streak, eligibleDayMap });

    if (currentStatus.currentStreak > 0) {
      return res.json({ success: false, message: "Chuỗi hiện vẫn đang được duy trì, chưa cần phục hồi" });
    }

    if (!currentStatus.longestStreak || currentStatus.longestStreak <= 0) {
      return res.json({ success: false, message: "Bạn chưa có chuỗi trước đó để phục hồi" });
    }

    if (currentStatus.recovery.usedThisMonth) {
      return res.json({ success: false, message: "Bạn đã dùng quyền phục hồi chuỗi trong tháng này" });
    }

    if (!currentStatus.recovery.recoverableDateKey) {
      return res.json({ success: false, message: "Hiện không có ngày nào đủ điều kiện để phục hồi chuỗi" });
    }

    const recoveredDateKey = currentStatus.recovery.recoverableDateKey;
    if (!streak.recoveredDates.includes(recoveredDateKey)) {
      streak.recoveredDates.push(recoveredDateKey);
    }

    streak.recoveryUsage.push({
      monthKey: currentStatus.todayDateKey.slice(0, 7),
      recoveredDateKey,
      usedAt: new Date(),
    });

    const updatedStatus = buildStatusPayload({ user, streak, eligibleDayMap });
    await streak.save();

    return res.json({
      success: true,
      message: `Đã phục hồi chuỗi cho ngày ${recoveredDateKey}`,
      streak: updatedStatus,
    });
  } catch (error) {
    console.error("Error recovering streak:", error);
    return res.json({ success: false, message: "Error recovering streak" });
  }
};

export {
  confirmMealCompletion,
  getStreakStatus,
  recoverStreak,
  updateStreakSettings,
};