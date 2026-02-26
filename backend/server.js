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
import "dotenv/config";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";

// app config
const app = express();
const port = process.env.PORT || 4000;

//middlewares
app.use(express.json());
app.use(cors());

// DB connection
connectDB();

// api endpoints
app.use("/api/food", foodRouter);
app.use("/images", express.static("uploads"));
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/meal-plan", mealPlanRouter);
app.use("/api/recipes", recipeRouter);
app.use("/api/weight", weightRouter);
app.use("/api/posts", postRouter);
app.use("/api/notifications", notificationRouter);

app.get("/", (req, res) => {
  res.send("API Working");
});

app.listen(port, () => {
  console.log(`Server Started on port: ${port}`);
});
