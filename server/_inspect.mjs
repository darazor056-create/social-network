import mongoose from "mongoose";
import User from "./models/User.js";

await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/social");
const users = await User.find().lean();
console.log("users in DB:", users.length);
for (const u of users) {
  console.log(`- username=${u.username} email=${u.email} hash=${String(u.password).slice(0,20)}...`);
}
await mongoose.disconnect();