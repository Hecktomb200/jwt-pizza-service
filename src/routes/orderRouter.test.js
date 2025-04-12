const request = require("supertest");
const express = require("express");
const orderRouter = require("./orderRouter");

jest.mock("../database/database.js", () => ({
  DB: {
    getMenu: jest.fn(),
    addMenuItem: jest.fn(),
    getOrders: jest.fn(),
    addDinerOrder: jest.fn(),
  },
  Role: {
    Admin: "Admin",
  },
}));

jest.mock("../config.js", () => ({
  factory: {
    url: "http://mockfactory.com",
    apiKey: "mock-api-key",
  },
}));

jest.mock("../metrics.js", () => ({
  track: () => (req, res, next) => next(),
  order: jest.fn(),
  orderFail: jest.fn(),
  trackPizzaLatency: jest.fn(),
}));

jest.mock("../logger.js", () => ({
  factoryLogger: jest.fn(),
}));

jest.mock("./authRouter.js", () => ({
  authRouter: {
    authenticateToken: (req, res, next) => {
      req.user = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        isRole: (role) => role === "Admin",
      };
      next();
    },
  },
}));

global.fetch = jest.fn();

const { DB } = require("../database/database.js");

describe("orderRouter", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/order", orderRouter);
    jest.clearAllMocks();
  });

  describe("GET /api/order/menu", () => {
    it("should return menu", async () => {
      DB.getMenu.mockResolvedValue([{ id: 1, title: "Veggie" }]);
      const res = await request(app).get("/api/order/menu");
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([{ id: 1, title: "Veggie" }]);
    });
  });

  describe("PUT /api/order/menu", () => {
    it("should add item when user is admin", async () => {
      DB.addMenuItem.mockResolvedValue();
      DB.getMenu.mockResolvedValue([{ id: 1, title: "Student" }]);
      const res = await request(app)
        .put("/api/order/menu")
        .send({ title: "Student" });
      expect(res.statusCode).toBe(200);
      expect(DB.addMenuItem).toHaveBeenCalled();
      expect(res.body).toEqual([{ id: 1, title: "Student" }]);
    });

    it("should return 403 if user is not admin", async () => {
      jest.resetModules();
      jest.doMock("./authRouter.js", () => ({
        authRouter: {
          authenticateToken: (req, res, next) => {
            req.user = {
              isRole: () => false,
            };
            next();
          },
        },
      }));
    
      const express = require("express");
      const testRouter = require("./orderRouter");
      const testApp = express();
      testApp.use(express.json());
      testApp.use("/api/order", testRouter);
    
      const res = await request(testApp)
        .put("/api/order/menu")
        .send({ title: "Invalid" });
    
      expect(res.statusCode).toBe(403);
    });    
    
  });

  describe("GET /api/order", () => {
    it("should return user orders", async () => {
      DB.getOrders.mockResolvedValue({ orders: [] });
      const res = await request(app).get("/api/order");
      expect(res.statusCode).toBe(200);
      expect(DB.getOrders).toHaveBeenCalled();
    });
  });

  describe("POST /api/order", () => {
    it("should create order successfully", async () => {
      const order = {
        id: 1,
        items: [{ menuId: 1, price: 0.05 }],
        franchiseId: 1,
        storeId: 1,
      };
      DB.addDinerOrder.mockResolvedValue(order);
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {},
        body: "response body",
        json: () => Promise.resolve({ reportUrl: "url", jwt: "token" }),
      });

      const res = await request(app)
        .post("/api/order")
        .send({ items: [{ menuId: 1, price: 0.05 }] });

      expect(res.statusCode).toBe(200);
      expect(res.body.order).toEqual(order);
      expect(res.body.jwt).toBe("token");
    });

    it("should return 500 if factory fails", async () => {
      DB.addDinerOrder.mockResolvedValue({
        items: [{ menuId: 1, price: 0.05 }],
      });
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: {},
        body: "response body",
        json: () =>
          Promise.resolve({
            reportUrl: "error-url",
          }),
      });

      const res = await request(app)
        .post("/api/order")
        .send({ items: [{ menuId: 1, price: 0.05 }] });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toMatch(/Failed to fulfill order/);
      expect(res.body.reportPizzaCreationErrorToPizzaFactoryUrl).toBe(
        "error-url"
      );
    });
  });
});
