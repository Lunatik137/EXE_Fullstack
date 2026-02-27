import cron from 'node-cron';
import mealPlanModel from '../models/mealPlanModel.js';
import { notifyMealSchedule } from '../controllers/notificationController.js';

// Run every minute to check for meal reminders
export const startMealReminderCron = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Find all active meal plans
      const mealPlans = await mealPlanModel.find({ status: 'active' }).populate('userId');

      for (const plan of mealPlans) {
        if (!plan.meals) continue;

        // Check each meal in the plan
        for (const meal of plan.meals) {
          if (meal.time === currentTime) {
            // Send notification
            await notifyMealSchedule(
              plan.userId._id,
              meal.name,
              meal.time
            );
          }
        }
      }
    } catch (error) {
      console.error('Meal reminder cron error:', error);
    }
  });

  console.log('Meal reminder cron job started');
};
