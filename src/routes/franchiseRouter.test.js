const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let admin;
let token;

beforeAll(async () => {
    admin = await createAdmin();
    token = await authenticateAdmin(admin);
});

async function authenticateAdmin(admin) {
    const response = await request(app).put('/api/auth').send(admin);
    expect(response.status).toBe(200);
    const token = response.body.token;
    expect(token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
    return token;
}

test('list franchises', async () => {
    const response = await request(app).get('/api/franchise').send();
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
});

test('create and delete store', async () => {
    const franchiseId = await createFranchise(admin.email);
    const storeId = await createStore(franchiseId);
    await deleteStore(franchiseId, storeId);
});

async function createFranchise(adminEmail) {
    const franchiseName = randomName();
    const newFranchise = { name: franchiseName, admins: [{ email: adminEmail }] };
    
    const response = await request(app).post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send(newFranchise);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    return response.body.id;
}

async function createStore(franchiseId) {
    const storeName = randomName();
    const newStore = { franchiseId, name: storeName };
    
    const response = await request(app).post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send(newStore);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toMatchObject({ name: storeName });
    return response.body.id;
}

async function deleteStore(franchiseId, storeId) {
    const response = await request(app).delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'store deleted' });
}

test('create, fetch, and delete franchise', async () => {
    const franchiseId = await createFranchise(admin.email);
    await fetchFranchise(franchiseId);
    await deleteFranchise(franchiseId);
});

async function fetchFranchise(franchiseId) {
    const response = await request(app).get(`/api/franchise/${admin.id}`)
        .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ id: franchiseId })
        ])
    );
}

async function deleteFranchise(franchiseId) {
    const response = await request(app).delete(`/api/franchise/${franchiseId}`)
        .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'franchise deleted' });
}

test('should return 403 when non-admin tries to create a franchise', async () => {
    const nonAdminUser  = await createNonAdminUser ();
    const token = await authenticateAdmin(nonAdminUser );
    
    const response = await request(app).post('/api/franchise')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Unauthorized Franchise', admins: [{ email: nonAdminUser .email }] });
    
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to create a franchise');
});

test('should return 403 when non-admin tries to delete a franchise', async () => {
    const nonAdminUser  = await createNonAdminUser ();
    const token = await authenticateAdmin(nonAdminUser );
    
    const franchiseId = await createFranchise(admin.email);
    
    const response = await request(app).delete(`/api/franchise/${franchiseId}`)
        .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to delete a franchise');
});

test('should return 403 when non-admin tries to create a store', async () => {
    const nonAdminUser  = await createNonAdminUser ();
    const token = await authenticateAdmin(nonAdminUser );
    
    const franchiseId = await createFranchise(admin.email);
    
    const response = await request(app).post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Unauthorized Store' });
    
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to create a store');
});

test('should return 403 when non-admin tries to delete a store', async () => {
    const nonAdminUser  = await createNonAdminUser ();
    const token = await authenticateAdmin(nonAdminUser );
    
    const franchiseId = await createFranchise(admin.email);
    const storeId = await createStore(franchiseId);
    
    const response = await request(app).delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to delete a store');
});

async function createNonAdminUser () {
    const user = {
        password: 'test',
        roles: [{ role: Role.User }], // Non-admin role
        name: randomName(),
        email: `${randomName()}@user.com`
    };
    const createdUser  = await DB.addUser (user);
    return { ...createdUser , password: 'test' };
}

async function createAdmin() {
    const user = {
        password: 'test',
        roles: [{ role: Role.Admin }],
        name: randomName(),
        email: `${randomName()}@admin.com`
    };
    const createdUser  = await DB.addUser (user);
    return { ...createdUser , password: 'test' };
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}