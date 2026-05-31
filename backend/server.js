import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import mealPlanRouter from "./routes/mealPlanRoute.js";
import recipeRouter from "./routes/recipeRoute.js";
import weightRouter from "./routes/weightRoute.js";
import postRouter from "./routes/postRoute.js";
import notificationRouter from "./routes/notificationRoute.js";
import payosRouter from "./routes/payosRoute.js";
import streakRouter from "./routes/streakRoute.js";
import manualMealPickRouter from "./routes/manualMealPickRoute.js";
import doctorRouter from "./routes/doctorRoute.js";
import consultationRouter from "./routes/consultationRoute.js";
import adminRouter from "./routes/adminRoute.js";
import voucherRouter from "./routes/voucherRoute.js";
import { startMealReminderScheduler, startAllNotificationSchedulers } from "./controllers/notificationController.js";
import "dotenv/config";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import ngrok from "ngrok";

// app config
const app = express();
const port = process.env.PORT || 4000;
const isNgrokEnabled =
  process.env.ENABLE_NGROK === "true" || Boolean(process.env.NGROK_AUTHTOKEN);
const hasExplicitPort = Boolean(process.env.PORT);

//middlewares
app.use(express.json());
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? [process.env.FRONTEND_URL, "https://greenpath.id.vn"].filter(Boolean)
      : true,
    credentials: true,
  })
);

// DB connection
connectDB();
startAllNotificationSchedulers();

// api endpoints
app.use("/api/food", foodRouter);
app.use("/images", express.static("uploads"));
app.use("/uploads", express.static("uploads"));
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/meal-plan", mealPlanRouter);
app.use("/api/recipes", recipeRouter);
app.use("/api/weight", weightRouter);
app.use("/api/posts", postRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/payos", payosRouter);
app.use("/api/streak", streakRouter);
app.use("/api/manual-meal-picks", manualMealPickRouter);
app.use("/api/doctors", doctorRouter);
app.use("/api/consultations", consultationRouter);
app.use("/api/admin", adminRouter);
app.use("/api/voucher", voucherRouter);

app.get("/", (req, res) => {
  res.send("API Working");
});

startServer(Number(port));

function startServer(targetPort) {
  const server = app.listen(targetPort, () => {
    console.log(`Server Started on port: ${targetPort}`);
    void startNgrok(targetPort);
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      if (hasExplicitPort) {
        console.error(
          `Port ${targetPort} is already in use. Update PORT in .env or stop the running process using that port.`
        );
        return;
      }

      const nextPort = targetPort + 1;
      console.warn(
        `Port ${targetPort} is already in use. Retrying on port ${nextPort}...`
      );
      startServer(nextPort);
      return;
    }

    throw error;
  });
}

async function startNgrok(activePort) {
  if (!isNgrokEnabled) {
    console.log(
      "Ngrok disabled. Set ENABLE_NGROK=true (and optionally NGROK_AUTHTOKEN) to expose a public URL."
    );
    return;
  }

  const parsedPort = Number(activePort);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    console.warn(`Ngrok skipped: invalid PORT value \"${activePort}\".`);
    return;
  }

  const tokenOption = process.env.NGROK_AUTHTOKEN
    ? { authtoken: process.env.NGROK_AUTHTOKEN }
    : {};

  const connectOptions = [
    { proto: "http", addr: parsedPort, ...tokenOption },
    { proto: "http", addr: String(parsedPort), ...tokenOption },
    { proto: "http", addr: `localhost:${parsedPort}`, ...tokenOption },
    { addr: `http://localhost:${parsedPort}`, ...tokenOption },
  ];

  let lastError = null;
  if (!process.env.NGROK_AUTHTOKEN) {
    console.warn(
      "NGROK_AUTHTOKEN is missing. Ngrok may fail depending on account policy."
    );
  }

  for (const options of connectOptions) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const url = await ngrok.connect(options);
        console.log("Public URL:", url);
        return;
      } catch (error) {
        lastError = error;
        const refused =
          error?.code === "ECONNREFUSED" ||
          String(error?.message || "").includes("ECONNREFUSED");

        if (!refused) {
          break;
        }

        await ngrok.kill().catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  console.error("Ngrok startup failed:", lastError?.message || lastError);
  if (lastError?.body) {
    console.error("Ngrok details:", JSON.stringify(lastError.body));
  }
}

// Start ngrok for public URL only when ENABLE_NGROK=true