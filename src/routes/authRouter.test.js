const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser  = { name: "pizza diner", email: "reg@test.com", password: "a" };
let adminToken;
let adminUser ;

async function createAdminUser () {
  let user = { password: "agoodone", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser (user);
  return { ...user, password: "agoodone" };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

beforeAll(async () => {
  const newAdmin = await createAdminUser ();
  const adminLogin = await request(app).put("/api/auth").send(newAdmin);
  adminToken = adminLogin.body.token;
  adminUser  = adminLogin.body.user;
});

test("register fail - missing fields", async () => {
  const failUser  = { name: "David Bowie", email: "wrongo@mail.com" };
  const registerRes = await request(app).post("/api/auth").send(failUser );
  expect(registerRes.status).toBe(400);
  expect(registerRes.body.message).toBe("name, email, and password are required");
});

test("register success", async () => {
  const newUser  = { name: "New User", email: "newuser@test.com", password: "password" };
  const registerRes = await request(app).post("/api/auth").send(newUser );
  expect(registerRes.status).toBe(200);
  expect(registerRes.body.user.email).toBe(newUser .email);
  expect(registerRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
});

test("login success", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser );
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  const user = { ...testUser , roles: [{ role: "diner" }] };
  expect(loginRes.body.user).toMatchObject(user);
});

test("login fail - incorrect credentials", async () => {
  const loginRes = await request(app).put("/api/auth").send({ email: "wrong@test.com", password: "wrongpassword" });
  expect(loginRes.status).toBe(401);
});

test("update user - success", async () => {
  const newPassword = "newpassword";
  const updateRes = await request(app)
    .put(`/api/auth/${adminUser .id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: adminUser .email, password: newPassword });

  expect(updateRes.status).toBe(200);
  expect(updateRes.body.email).toBe(adminUser .email);
});

test("update user - unauthorized", async () => {
  const newPassword = "newpassword";
  const unauthorizedToken = "invalidtoken";

  const updateRes = await request(app)
    .put(`/api/auth/${adminUser .id}`)
    .set("Authorization", `Bearer ${unauthorizedToken}`)
    .send({ email: adminUser .email, password: newPassword });

  expect(updateRes.status).toBe(401);
});

test("logout user - success", async () => {
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");
});

test("logout user - unauthorized", async () => {
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer invalidtoken`);

  expect(logoutRes.status).toBe(401);
  expect(logoutRes.body.message).toBe("unauthorized");
});