import express from "express";
import { Register, Login } from "../controllers/auth.js";
import { Refresh } from "../controllers/refreshToken.js";
const Router = express.Router();
Router.post("/register", Register);
Router.post("/login", Login);
Router.post("/refresh", Refresh);

export default Router;
