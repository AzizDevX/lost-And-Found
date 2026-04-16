import express from "express";
import { Register, Login, Logout } from "../controllers/auth.js";
import { Refresh } from "../controllers/refreshToken.js";
const Router = express.Router();
Router.post("/register", Register);
Router.post("/login", Login);
Router.post("/refresh", Refresh);
Router.post("/logout", Logout);

export default Router;
