const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let adminToken;
let adminUser;
let franchise;

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createStore() {
  let storeName = randomName();
  let number = Math.floor(Math.random() * 100);

  const newStore = await request(app)
    .post("/api/franchise/" + franchise.id + "/store")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ franchiseId: number, name: storeName });
  return newStore;
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;

  const newAdmin = await createAdminUser();
  console.log(newAdmin);
  const adminLogin = await request(app).put("/api/auth").send(newAdmin);
  console.log(adminLogin.body);
  adminToken = adminLogin.body.token;
  adminUser = adminLogin.body.user;
  console.log(adminUser);
});

beforeEach(async () => {
  let franchiseName = randomName();

  let franchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: franchiseName, admins: [{ email: adminUser.email }] });

  franchise = franchiseRes.body;
});

test("list franchises", async () => {
  const franRes = await request(app).get("/api/franchise");
  console.log(franRes.body);
  expect(franRes.status).toBe(200);
});

test("list user franchises", async () => {
  const userFran = await request(app)
    .get("/api/franchise/" + adminUser.id)
    .set("Authorization", `Bearer ${adminToken}`);
  console.log(userFran.body);
  expect(userFran.status).toBe(200);
});

test("create a franchise", async () => {
  let franchiseName = randomName();

  const createFran = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: franchiseName, admins: [{ email: adminUser.email }] });
  console.log(createFran.body);
  expect(createFran.status).toBe(200);
});

test("not an admin franchise", async () => {
  let franchiseName = randomName();

  const createFran = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send({ name: franchiseName, admins: [{ email: adminUser.email }] });
  console.log(createFran.body);
  expect(createFran.status).toBe(403);
});

test("delete franchise", async () => {
  const deleteFran = await request(app)
    .delete("/api/franchise/" + franchise.id)
    .set("Authorization", `Bearer ${adminToken}`);
  console.log(deleteFran.body);
  expect(deleteFran.status).toBe(200);
});

test("create store", async () => {
  let store = await createStore();
  console.log(store.body);
  expect(store.status).toBe(200);
});

test("delete store", async () => {
  let store = await createStore();
  const deleteStore = await request(app)
    .delete("/api/franchise/" + franchise.id + "/store/" + store.body.id)
    .set("Authorization", `Bearer ${adminToken}`);
  console.log(deleteStore.body);
  expect(store.status).toBe(200);
});