import express from "express";
import validateEditAccountData from "../middlewares/validateEditAccountData.js";
import { editAccountData } from "../controllers/account/editAccountData.js";
import { getAccountData } from "../controllers/account/getAccountData.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { createUploader } from "../middlewares/UploadMiddleware.js";
import path from "path";

const Router = express.Router();
const avatarUpload = createUploader(
  (req) => path.join("uploads", "users", req.user.id),
  { maxSizeMB: 2 },
);

Router.get("/user", authMiddleware, getAccountData);
Router.put("/edit", authMiddleware, validateEditAccountData, editAccountData);
Router.put(
  "/picture",
  authMiddleware,
  avatarUpload.single("avatar"),
  validateEditAccountData,
  editAccountData,
);

export default Router;
