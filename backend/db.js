const mysql = require('mysql2');

// Create a connection to the database
const db = mysql.createConnection({
  host: 'localhost', // Use '127.0.0.1' if localhost doesn't work
  user: 'root',      // Replace with your MySQL username
  password: '',      // Replace with your MySQL password
  database: 'chat-app' // Your database name
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
    return;
  }
  console.log('Connected to MySQL database: chat-app');
});

module.exports = db;
