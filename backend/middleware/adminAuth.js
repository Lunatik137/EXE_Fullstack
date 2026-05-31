import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

const adminAuth = async (req, res, next) => {
  const { token } = req.headers;
  if (!token) {
    return res.json({ success: false, message: "Not Authorized" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.id).select("role");
    if (!user || user.role !== "admin") {
      return res.json({ success: false, message: "Admin access required" });
    }
    req.userId = decoded.id;
    req.userRole = "admin";
    if (!req.body) req.body = {};
    req.body.userId = decoded.id;
    next();
  } catch (error) {
    res.json({ success: false, message: "Invalid token" });
  }
};

export default adminAuth;
``