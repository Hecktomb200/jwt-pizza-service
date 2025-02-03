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

test('store run', async () => {
    const franchiseName = randomName();
    const newFranchise = { name: franchiseName, admins: [{ email: adminUser.email }] };
    
    const franchiseResponse = await request(app).post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(newFranchise);
    expect(franchiseResponse.status).toBe(200);
    const franchiseId = franchiseResponse.body.id;
    
    const storeName = randomName();
    const newStore = { franchiseId, name: storeName };
    
    const storeResponse = await request(app).post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(newStore);
    expect(storeResponse.status).toBe(200);
    expect(storeResponse.body).toHaveProperty('id');
    expect(storeResponse.body).toMatchObject({ name: storeName });

    const storeId = storeResponse.body.id;
    const deleteStoreResponse = await request(app).delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${adminAuthToken}`);
    expect(deleteStoreResponse.status).toBe(200);
    expect(deleteStoreResponse.body).toEqual({ message: 'store deleted' });
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