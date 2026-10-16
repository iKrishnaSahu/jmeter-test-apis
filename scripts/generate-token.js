#!/usr/bin/env node
/**
 * Utility script to generate a signed JWT token directly from the CLI.
 * 
 * Usage:
 *   node scripts/generate-token.js [username] [expiration]
 * 
 * Example:
 *   node scripts/generate-token.js testuser 24h
 */

let jwt;
try {
  jwt = require("jsonwebtoken");
} catch {
  jwt = require("../functions/node_modules/jsonwebtoken");
}

const JWT_SECRET = process.env.JWT_SECRET || "default-dev-secret-change-in-production";
const username = process.argv[2] || "testuser";
const expiresIn = process.argv[3] || "24h";

const payload = {
  sub: username,
  role: "performance-tester",
  iss: "firebase-cloud-functions",
  iat: Math.floor(Date.now() / 1000),
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn });

console.log("\n=======================================================");
console.log("             JWT Token Generated Successfully          ");
console.log("=======================================================");
console.log(`Username:   ${username}`);
console.log(`Expires In: ${expiresIn}`);
console.log(`Token:      ${token}`);
console.log("=======================================================");
console.log("\nExample Curl with this token:");
console.log(`curl -X GET "http://127.0.0.1:5001/<project-id>/<region>/api/protected" \\`);
console.log(`  -H "Authorization: Bearer ${token}"\n`);
