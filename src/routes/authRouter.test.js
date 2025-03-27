const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser  = { name: "pizza diner", email: "reg@test.com", password: "a" };
let adminToken;
let adminUser ;

async function createAdmin() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = generateRandomName();
  user.email = `${user.name}@admin.com`;
  return await DB.addUser (user);
}

function generateRandomName() {
  return Math.random().toString(36).substring(2, 12);
}

beforeAll(async () => {
  testUser .email = `${generateRandomName()}@test.com`;
  //const registerResponse = await request(app).post("/api/auth").send(testUser );
  const newAdmin = await createAdmin();
  adminUser  = await request(app).put("/api/auth").send(newAdmin);
  adminToken = adminUser .body.token;
});

test("register fails without required fields", async () => {
  const incompleteUser  = { name: "David Bowie", email: "wrongo@mail.com" };
  const response = await request(app).post("/api/auth").send(incompleteUser );
  expect(response.status).toBe(400);
});

test("successful login", async () => {
  const loginResponse = await request(app).put("/api/auth").send(testUser );
  expect(loginResponse.status).toBe(200);
  expect(loginResponse.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
});

test("update user details", async () => {
  const updatedUser  = { email: testUser .email, password: "new_password" };
  const response = await request(app)
    .put(`/api/auth/${adminUser .body.user.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send(updatedUser );
  expect(response.status).toBe(200);
});

test("logout user", async () => {
  const response = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${adminToken}`);
  expect(response.status).toBe(200);
  expect(response.body.message).toBe("logout successful");
});