import jwt from "jsonwebtoken";

// Optional authentication - doesn't block if no token, just adds userId if token exists
const optionalAuthMiddleware = async (req, res, next) => {
  const { token } = req.headers;
  
  if (!token) {
    // No token provided, continue without userId
    next();
    return;
  }
  
  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    req.body.userId = token_decode.id;
    req.body.userRole = token_decode.role;
  } catch (error) {
    // Invalid token, just continue without userId
    console.log("Invalid token in optional auth:", error.message);
  }
  
  next();
};

export default optionalAuthMiddleware;
