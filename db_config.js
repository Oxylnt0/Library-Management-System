const { createClient } = require("@libsql/client");

// =========================================================
// CONFIGURATION
// Get these details from your Turso Dashboard (turso.tech)
// =========================================================

const url = "libsql://puertopalabradb-oxylnt0.aws-ap-northeast-1.turso.io"; // Replace with your Database URL
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzAxNzI0MjcsImlkIjoiNzhiN2YyZTMtNGU1OS00N2JkLWFiNDMtZGU2ZjdiNTMzZGRkIiwicmlkIjoiNGI4ZGM1YjYtMjU0YS00NGRiLWIxYjgtNTU4YTZlY2NlZjM4In0.ybuRGiwyBFuQJqm0bZE5UqEVm8ZMehD8L0-UivrjZJ4OkiUquvpe8GrDeXeGwG7OvsTlioDBY9wSxfnCT4y5BQ"; // Replace with your long Auth Token

// =========================================================
// CREATE CONNECTION
// =========================================================

const db = createClient({
  url,
  authToken,
});

// Use this 'db' object in other files to run queries like:
// await db.execute("SELECT * FROM books");

module.exports = { db };