const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser  = { name: "pizza diner", email: "reg@test.com", password: "a" };
let adminToken;
let adminUser ;

async function createAdminUser () {
  const user = {
    password: "agoodpassword",
    roles: [{ role: Role.Admin }],
    name: generateRandomName(),
    email: `${generateRandomName()}@admin.com`,
  };

  const createdUser  = await DB.addUser (user);
  return { ...createdUser , password: user.password };
}

function generateRandomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function loginAsAdmin() {
  const adminLogin = await request(app).put("/api/auth").send({
    name: adminUser .name,
    email: adminUser .email,
    password: adminUser .password,
  });
  return adminLogin.body;
}

beforeAll(async () => {
  adminUser  = await createAdminUser ();
  const adminLogin = await loginAsAdmin();
  adminToken = adminLogin.token;
});

describe("Authentication Tests", () => {
  test("should fail to register a user with missing fields", async () => {
    const incompleteUser  = { name: "David Bowie", email: "wrongo@mail.com" };
    const response = await request(app).post("/api/auth").send(incompleteUser );
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("name, email, and password are required");
  });

  test("should register a new user successfully", async () => {
    testUser .email = `${generateRandomName()}@test.com`;
    const registerResponse = await request(app).post("/api/auth").send(testUser );
    
    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body.user.email).toBe(testUser .email);
    
    const tokenPattern = /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/;
    expect(registerResponse.body.token).toMatch(tokenPattern);
  });

  test("should log in an existing user", async () => {
    const registerResponse = await request(app).post("/api/auth").send(testUser );
    expect(registerResponse.status).toBe(200);
    
    const loginResponse = await request(app).put("/api/auth").send(testUser );
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
    
    const { password, ...userWithoutPassword } = { ...testUser , roles: [{ role: "diner" }] };
    
    expect(password).toBe(testUser .password);
    
    expect(loginResponse.body.user).toMatchObject(userWithoutPassword);
  });

  test("should update admin user successfully", async () => {
    const newPassword = "1234";
    const updateResponse = await request(app)
      .put(`/api/auth/${adminUser .id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: adminUser .email, password: newPassword });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.email).toBe(adminUser .email);
  });

  test("should log out the user successfully", async () => {
    const logoutResponse = await request(app)
      .delete("/api/auth")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toBe("logout successful");
  });

  test("should fail to log out with an invalid token", async () => {
    const invalidToken = "invalidtoken";
    const logoutResponse = await request(app)
      .delete("/api/auth")
      .set("Authorization", `Bearer ${invalidToken}`);

    expect(logoutResponse.status).toBe(401);
    expect(logoutResponse.body.message).toBe("unauthorized");
  });
});