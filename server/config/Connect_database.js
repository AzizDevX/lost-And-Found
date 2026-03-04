import mongoose from "mongoose";

export async function connectDB() {
  try {
    await mongoose.connect(process.env.Mongo_URL);
    console.log("MONGO DATABASE CONNECTED");
  } catch (err) {
    console.error(`X || Db Connection Failure ${err}`);
    process.exit(1);
  }
}
