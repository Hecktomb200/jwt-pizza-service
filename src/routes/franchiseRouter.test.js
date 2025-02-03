const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let admin;
let token;

beforeAll(async () => {
    admin = await createAdmin();
    const response = await request(app).put('/api/auth').send(admin);
    expect(response.status).toBe(200);
    token = response.body.token;
    expect(token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
});

test('list', async () => {
    const response = await request(app).get('/api/franchise').send();
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
});

async function createAdmin() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = `${user.name}@admin.com`;
    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}