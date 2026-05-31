import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
  console.log('\n🔐 [AUTH MIDDLEWARE]');
  console.log('   Headers:', Object.keys(req.headers));
  console.log('   Token present:', req.headers.token ? 'YES' : 'NO');
  
  const { token } = req.headers;
  if (!token) {
    console.log('   ❌ No token in headers');
    return res.json({ success: false, message: "Not Authorized Login Again" });
  }
  
  try {
    console.log('   ✅ Token found, verifying...');
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    console.log('   ✅ Token verified, userId:', token_decode.id);
    
    req.userId = token_decode.id;
    req.userRole = token_decode.role;
    if (!req.body) req.body = {};
    req.body.userId = token_decode.id;
    req.body.userRole = token_decode.role;
    
    console.log('   ✅ requestBody updated with userId')
    next();
  } catch (error) {
    console.log('   ❌ Token verification failed:', error.message);
    res.json({success:false,message:"Error"});
  }
};
export default authMiddleware;
