import express from "express";
import { Register } from "../controllers/auth.js";
const Router = express.Router();
Router.post("/register", Register);
export default Router;
