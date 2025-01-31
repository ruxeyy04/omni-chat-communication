const express = require("express");
const db = require("./db");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const Pusher = require("pusher");
let dotenv = require('dotenv').config()
const app = express();
const secretKey = "omni-channel-comms"; // Secret key for JWT
const voiceCallRoutes = require('./voiceCall');
const twilioRoutes = require('./twilioRoutes');

const pusher = new Pusher({
  appId: process.env.PUSHER_APPID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSHER,
  useTLS: true
});

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(voiceCallRoutes);
app.use(twilioRoutes);

app.use(express.urlencoded({ extended: true }));
// Ensure 'public/uploads' directory exists
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Save in public/uploads
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Keep original filename
  }
});


const upload = multer({ storage });


// ---------------- REGISTER ----------------
app.post("/register", async (req, res) => {
  const { fullname, email, password, contact } = req.body;
  if (!fullname || !email || !password || !contact) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `INSERT INTO users (fullname, email, password, contact) VALUES (?, ?, ?, ?)`;

    db.query(query, [fullname, email, hashedPassword, contact], (err) => {
      if (err) {
        console.error("Error inserting user:", err.message);
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ message: "Email already exists!" });
        }
        return res.status(500).json({ message: "Database error" });
      }
      res.status(201).json({ message: "Registration successful!" });
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------- LOGIN ----------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const query = `SELECT * FROM users WHERE email = ?`;
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(400).json({ message: "User not found" });

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(400).json({ message: "Incorrect password" });

    const token = jwt.sign({ userId: user.id, fullname: user.fullname }, secretKey, { expiresIn: "1h" });
    res.status(200).json({ message: "Login successful", token });
  });
});

// ---------------- GET USERS ----------------
// Get User Info API
app.get("/getUserInfo",async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Get token from Authorization header

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Get user data based on the decoded userId
    const query = `SELECT id, fullname, email, contact FROM users WHERE id = ?`;
    db.query(query, [decoded.userId], (err, results) => {
      if (err) {
        console.error("Error fetching user info:", err.message);
        return res.status(500).json({ message: "Database error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(results[0]); // Send user data
    });
  });
});


// Get Users API
app.get("/getUsers/:id", async (req, res) => {
  const { id } = req.params;
  const query = `SELECT id, fullname, email FROM users WHERE id != ?`; // Fetch users except the specified one
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error fetching users:", err.message);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(results); // Send user list
  });
});


// ---------------- SEND MESSAGE ----------------
// Modify sendMessage to handle file uploads
app.post("/sendMessage", upload.single("attachment"), (req, res) => {
  const { sender_id, receiver_id, message } = req.body;
  const attachment = req.file ? req.file.filename : null; // Get uploaded file name

  if (!sender_id || !receiver_id || (!message && !attachment)) {
    return res.status(400).json({ message: "Message or file is required!" });
  }

  const query = `INSERT INTO messages (sender_id, receiver_id, message, attachment, timestamp) VALUES (?, ?, ?, ?, NOW())`;

  db.query(query, [sender_id, receiver_id, message, attachment], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });

    const selectQuery = `SELECT * FROM messages WHERE id = ?`;
    db.query(selectQuery, [result.insertId], (err, rows) => {
      if (err) return res.status(500).json({ message: "Database error" });

      const messageData = rows[0]; // Get inserted message with timestamp

      // Include full URL for attachments when sending via Pusher
      if (messageData.attachment) {
        messageData.attachment = `${messageData.attachment}`;
      }

      // Send the message with timestamp via Pusher
      pusher.trigger("chat", "message", messageData);

      // Send response to frontend
      res.status(201).json(messageData);
    });
  });
});
// ---------------- GET CHAT HISTORY ----------------
app.get("/getMessages/:sender_id/:receiver_id", (req, res) => {
  const { sender_id, receiver_id } = req.params;
  const query = `
    SELECT * FROM messages 
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
    ORDER BY timestamp ASC
  `;

  db.query(query, [sender_id, receiver_id, receiver_id, sender_id], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.status(200).json(results);
  });
});









// ---------------- START SERVER ----------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
