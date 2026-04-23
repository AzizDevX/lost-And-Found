import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/Connect_database.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import authRoutes from "./routers/auth.router.js";
import accountRoutes from "./routers/account.router.js";
import announcementRoutes from "./routers/announcement.router.js";
import adminRouters from "./routers/admin.router.js";
import announcmentRouters from "./routers/announcement.router.js";

dotenv.config();
connectDB();
const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api", announcementRoutes);
app.use("/api/admin", adminRouters);

const BACKEND_PORT = process.env.BACKEND_PORT || 5000;
app.listen(BACKEND_PORT, () => {
  console.log(`Server Alive At Port : ${BACKEND_PORT}`);
});
