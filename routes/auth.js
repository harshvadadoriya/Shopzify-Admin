const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const verifyToken = require("../middleware/verifyToken");
require("dotenv").config();

// User signup
router.post("/signup", async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Create a new user
    const user = new User({
      name,
      email,
      phone,
      password,
    });

    await user.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// User login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Account with provided email does not exist" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Please try again!",
        subMessage: "Your Email and password do not match",
      });
    }

    // Generate access token
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN,
      {
        expiresIn: "1h",
      }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN,
      { expiresIn: "7d" }
    );

    res.cookie("refreshToken", refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      sameSite: "strict",
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin Login
router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email, role: "admin" });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Admin with the provided email does not exist" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password does not match" });
    }

    // Check if the user is an admin
    if (user.role !== "admin") {
      return res.status(401).json({ message: "Unauthorized Access" });
    }

    // Generate access token
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN,
      {
        expiresIn: "1h",
      }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN,
      {
        expiresIn: "7d",
      }
    );

    res.cookie("refreshToken", refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      sameSite: "strict",
    });

    res.json({ message: "You have successfully logged in", accessToken });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  try {
    // Clear access token cookie on the client-side
    res.clearCookie("refreshToken");
    return res.status(200).json({
      message: "User logged out successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Refresh token
router.get("/refresh", async (req, res) => {
  if (req?.cookies?.refreshToken == undefined) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  const { refreshToken } = req.cookies;
  try {
    // Verify the refresh token
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN, (err, user) => {
      if (err) {
        return res.status(403).json({ message: "Invalid refresh token" });
      }

      // Generate a new access token
      const accessToken = jwt.sign(
        { userId: user.userId },
        process.env.ACCESS_TOKEN,
        { expiresIn: "1h" }
      );

      // Send the new access token in the response
      res.json({ accessToken });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Protected route
router.get("/profile", verifyToken, async (req, res) => {
  try {
    // Access the authenticated user ID using req.userId
    const userId = req.userId;

    // Retrieve the user data from the database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send the user data as a JSON response
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
