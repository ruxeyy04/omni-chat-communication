const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const VoiceResponse = require("twilio").twiml.VoiceResponse;
const app = express();
const Pusher = require("pusher");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
const db = require("./db");

const client = twilio(accountSid, authToken);
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const pusher = new Pusher({
  appId: process.env.PUSHER_APPID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSHER,
  useTLS: true,
});

router.use(express.urlencoded({ extended: true }));
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
  },
});

const upload = multer({ storage });



// SMS Feature

// ---------------- GET SMS LIST HISTORY ----------------

router.get("/getcontacthistory/:phonenumber", async (req, res) => {
  const phoneNumber = req.params.phonenumber;

  try {
    const query = `
      SELECT DISTINCT 
        CASE 
          WHEN sender = ? THEN receiver 
          WHEN receiver = ? THEN sender 
        END AS number
      FROM sms
      WHERE sender = ? OR receiver = ?
    `;

    db.query(
      query,
      [phoneNumber, phoneNumber, phoneNumber, phoneNumber],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: "Internal server error" });
        }

        // Filter out null values in case there's a mismatch in the CASE statement
        const filteredResults = results.filter((row) => row.number !== null);

        res.json(filteredResults);
      }
    );
  } catch (error) {
    console.error("Error fetching SMS history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// ---------------- GET SMS MESSAGE HISTORY ----------------
router.get("/getmsghistory/:sender_id/:receiver_id", (req, res) => {
  const { sender_id, receiver_id } = req.params;

  // MySQL query with conditional timestamp formatting
  const query = `
  SELECT 
    *,
    CASE
      WHEN DATE(timestamp) = CURDATE() THEN DATE_FORMAT(timestamp, '%l:%i %p')  -- Time format for today with space before AM/PM
      ELSE DATE_FORMAT(timestamp, '%M %e, %Y | %l:%i %p')  -- Full date + time for past dates with space before AM/PM
    END AS formatted_timestamp
  FROM sms
  WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
  ORDER BY timestamp ASC
`;

  db.query(
    query,
    [sender_id, receiver_id, receiver_id, sender_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });

      // Map through the results to ensure the formatted timestamp and attachment URL are updated
      const messages = results.map((message) => ({
        ...message,
        timestamp: message.formatted_timestamp, // Update timestamp field
        attachment: message.attachment
          ? `${process.env.BASE_URL}/uploads/${message.attachment}`
          : null, // Add full URL to attachment
      }));

      res.status(200).json(messages);
    }
  );
});

// ---------------- COMPOSE/SEND SMS MESSAGE  ----------------

router.post("/msgcompose", upload.single("attachment"), (req, res) => {
  const { sender_id, receiver_id, message } = req.body;
  const attachment = req.file ? req.file.filename : null; // Get uploaded file name

  if (!sender_id || !receiver_id || (!message && !attachment)) {
    return res.status(400).json({ message: "Message or file is required!" });
  }

  const query = `INSERT INTO sms (sender, receiver, message, attachment, timestamp) VALUES (?, ?, ?, ?, NOW())`;

  db.query(
    query,
    [sender_id, receiver_id, message, attachment],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Database error" });

      const selectQuery = `SELECT * FROM sms WHERE id = ?`;
      db.query(selectQuery, [result.insertId], async (err, rows) => {
        if (err) return res.status(500).json({ message: "Database error" });

        let messageData = rows[0]; // Get inserted message with timestamp
        let filename = messageData.attachment;
        // Construct full attachment URL if there is an attachment
        if (messageData.attachment) {
          messageData.attachment = `${process.env.BASE_URL}/uploads/${messageData.attachment}`;
        }
        console.log(`${process.env.BASE_URL}/uploads/${filename}`);
        const sms_msg = await client.messages.create({
          body: message,
          from: sender_id,
          to: receiver_id,
          ...(messageData.attachment && {
            mediaUrl: [`${process.env.BASE_URL}/uploads/${filename}`],
          }),
        });

        // Send response to frontend with full attachment URL
        res.status(201).json({
          id: messageData.id,
          sender: messageData.sender,
          receiver: messageData.receiver,
          message: messageData.message,
          attachment: messageData.attachment, // Send full URL to frontend
          timestamp: messageData.timestamp,
        });
      });
    }
  );
});

// ---------------- INCOMING SMS MESSAGE SAVE  ----------------
router.post("/incomingmsg", (req, res) => {
  console.log("Incoming webhook body:", req.body); // Debug log

  // Check if we have the required data
  if (!req.body.From || !req.body.To || !req.body.Body) {
    console.error("Missing required SMS data:", req.body);
    return res.status(400).json({ error: "Missing required SMS data" });
  }

  const sender = req.body.From;
  const receiver = req.body.To;
  const message = req.body.Body;
  const attachment = req.body.MediaUrl0;

  try {
    const query = `
      INSERT INTO sms (sender, receiver, message, attachment, timestamp)
      VALUES (?, ?, ?, ?, NOW())
    `;

    db.query(
      query,
      [sender, receiver, message, attachment || null],
      (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: "Failed to save message" });
        }
        pusher.trigger("sms", "convo", {
          phonenumber: sender,
          message: "New message received",
        });

        console.log(
          `Saved SMS - From: ${sender}, To: ${receiver}, Message: ${message}`
        );

        // Send TwiML response back to Twilio
        res.type("text/xml");
        res.send(`
          <Response>
          </Response>
        `);
      }
    );
  } catch (error) {
    console.error("Error handling incoming SMS:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/fallbackmsg", (req, res) => {
  console.log("Fallback Message");
  res.status(200).json({
    msg: "Fallback Message",
  });
});

module.exports = router;
