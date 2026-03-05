import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/Connect_database.js";
import authRoutes from "./routers/auth.router.js";
import cookieParser from "cookie-parser";
dotenv.config();
connectDB();
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);

const BACKEND_PORT = process.env.BACKEND_PORT || 5000;
app.listen(BACKEND_PORT, () => {
  console.log(`Server Alive At Port : ${BACKEND_PORT}`);
});
