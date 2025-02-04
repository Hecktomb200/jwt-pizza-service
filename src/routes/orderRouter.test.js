const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let user;
let token;
let f_Id;
//let s_Id;

beforeAll(async () => {
    user = await createAdmin();
    const newAdmin = await request(app).put('/api/auth').send(user);
    token = newAdmin.body.token;
    expect(token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

    const franchiseName = randomName();
    const newFranchise = { name: franchiseName, admins: [{ email: user.email }] };
    const createdFranchise = await request(app).post('/api/franchise')
        .set('Authorization', `Bearer ${token}`).send(newFranchise);
    expect(createdFranchise.status).toBe(200);
    f_Id = createdFranchise.body.id;
    
    const storeName = randomName();
    const newStore = { f_Id, name: storeName };
    const createdStore = await request(app).post(`/api/franchise/${f_Id}/store`)
        .set('Authorization', `Bearer ${token}`).send(newStore);
    expect(createdStore.status).toBe(200);
    //s_Id = createdStore.body.id;
    const menuResponse = await request(app).get('/api/order/menu').send();
    if (menuResponse.body.length === 0) {
        await request(app).put('/api/order/menu')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: "Veggie", description: "A garden of delight", image: "pizza1.png", price: 0.0038 });
    }
});

test('get', async () => {
    const result = await request(app).get('/api/order/menu').send();
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body)).toBe(true);
});

test('add', async () => {
    const newItem = { title: "Student", description: "No topping, no sauce, just carbs", image: "pizza9.png", price: 0.0001 };
    const result = await request(app).put('/api/order/menu')
        .set('Authorization', `Bearer ${token}`).send(newItem);
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body)).toBe(true);
    expect(result.body).toEqual(expect.arrayContaining([expect.objectContaining(newItem)]));
});

async function createAdmin() {
    let user = { password: 'test', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = `${user.name}@test.com`;
    user = await DB.addUser(user);
    return { ...user, password: 'test' };
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}