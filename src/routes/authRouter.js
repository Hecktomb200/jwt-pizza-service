const express = require("express");
const jwt = require("jsonwebtoken");
const config = require("../config.js");
const { asyncHandler } = require("../endpointHelper.js");
const { DB, Role } = require("../database/database.js");
const metric = require("../metrics.js");

const authRouter = express.Router();

authRouter.endpoints = [
  {
    method: "POST",
    path: "/api/auth",
    description: "Register a new user",
    example: `curl -X POST localhost:3000/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'`,
    response: { user: { id: 2, name: "pizza diner", email: "d@jwt.com", roles: [{ role: "diner" }] }, token: "tttttt" },
  },
  {
    method: "PUT",
    path: "/api/auth",
    description: "Login existing user",
    example: `curl -X PUT localhost:3000/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json'`,
    response: { user: { id: 1, name: "常用名字", email: "a@jwt.com", roles: [{ role: "admin" }] }, token: "tttttt" },
  },
  {
    method: "PUT",
    path: "/api/auth/:userId",
    requiresAuth: true,
    description: "Update user",
    example: `curl -X PUT localhost:3000/api/auth/1 -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
    response: { id: 1, name: "常用名字", email: "a@jwt.com", roles: [{ role: "admin" }] },
  },
  {
    method: "DELETE",
    path: "/api/auth",
    requiresAuth: true,
    description: "Logout a user",
    example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'`,
    response: { message: "logout successful" },
  },
];

async function authenticateUser (req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      if (await DB.isLoggedIn(token)) {
        req.user = jwt.verify(token, config.jwtSecret);
        req.user.hasRole = (role) => req.user.roles.some(r => r.role === role);
      }
    } catch {
      req.user = null;
    }
  }
  next();
}

authRouter.authenticateToken = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "unauthorized" });
  }
  next();
};

authRouter.post("/", asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, and password are required" });
  }
  const user = await DB.addUser ({ name, email, password, roles: [{ role: Role.Diner }] });
  const token = await generateToken(user);
  res.json({ user, token });
}));

authRouter.put("/", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await DB.getUser (email, password);
  const token = await generateToken(user);
  res.json({ user, token });
}));

authRouter.delete("/", authRouter.authenticateToken, asyncHandler(async (req, res) => {
  await revokeToken(req);
  res.json({ message: "logout successful" });
}));

authRouter.put("/:userId", authRouter.authenticateToken, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const userId = Number(req.params.userId);
  const user = req.user;
  if (user.id !== userId && !user.hasRole(Role.Admin)) {
    return res.status(403).json({ message: "unauthorized" });
  }
  const updatedUser  = await DB.updateUser (userId, email, password);
  res.json(updatedUser );
}));

async function generateToken(user) {
  const token = jwt.sign(user, config.jwtSecret);
  await DB.loginUser (user.id, token);
  return token;
}

async function revokeToken(req) {
  const token = extractToken(req);
  if (token) {
    await DB.logoutUser (token);
  }
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  return authHeader ? authHeader.split(" ")[1] : null;
}

module.exports = { authRouter, authenticateUser  };