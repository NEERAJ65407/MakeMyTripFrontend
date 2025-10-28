/**
 * @file tests/otpverify.test.js
 */
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock Twilio client
jest.mock("twilio", () => {
  const verifyService = {
    verificationChecks: {
      create: jest.fn(),
    },
  };
  const client = {
    verify: {
      services: jest.fn(() => verifyService),
    },
  };
  return jest.fn(() => client);
});

// Mock User model
jest.mock("../models/User", () => ({
  findOne: jest.fn(),
}));
const User = require("../models/User");
const twilio = require("twilio");

// Import route
const otpRoute = require("../routes/auth"); // Adjust path as needed

describe("POST /otpverify (6-digit OTP)", () => {
  let app;
  const mockService = twilio().verify.services();

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/auth", otpRoute);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("✅ should verify OTP and return auth token", async () => {
    User.findOne.mockResolvedValue({ id: "user123" });

    mockService.verificationChecks.create.mockResolvedValue({
      status: "approved",
    });

    const res = await request(app)
      .post("/auth/otpverify?mobile_number=9999999999")
      .send({ code: "123456" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("authToken");
    expect(mockService.verificationChecks.create).toHaveBeenCalledWith({
      to: "+919999999999",
      code: "123456",
    });
  });

  test("❌ should fail when OTP is invalid", async () => {
    User.findOne.mockResolvedValue({ id: "user123" });

    mockService.verificationChecks.create.mockResolvedValue({
      status: "pending",
    });

    const res = await request(app)
      .post("/auth/otpverify?mobile_number=9999999999")
      .send({ code: "654321" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: "Invalid OTP" });
  });

  test("❌ should return validation error for short OTP", async () => {
    const res = await request(app)
      .post("/auth/otpverify?mobile_number=9999999999")
      .send({ code: "123" });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});
