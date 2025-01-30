import React, { useEffect, useState } from "react";
import Navbar from "../Components/Navbar";
import "../assets/chat.css"; // Import the CSS file
import { IoIosSend } from "react-icons/io";
import axios from "axios";
import Pusher from "pusher-js";

const Chat = () => {
  const [users, setUsers] = useState([]); // Store users
  const [search, setSearch] = useState(""); // Store search input
  const [selectedUser, setSelectedUser] = useState(null); // Store selected user
  const [messages, setMessages] = useState([]); // Store messages
  const [message, setMessage] = useState(""); // Store new message input
  const [userId, setUserId] = useState(null); // Current logged-in user ID
  const [file, setFile] = useState(null);

  useEffect(() => {
    // Get logged-in user info
    axios
      .get("http://localhost:3000/getUserInfo", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      })
      .then((response) => {
        setUserId(response.data.id);
      })
      .catch((error) => console.error("Error fetching user info:", error));
  }, []);

  // Fetch users when userId is set
  useEffect(() => {
    if (userId) {
      axios
        .get(`http://localhost:3000/getUsers/${userId}`)
        .then((response) => {
          setUsers(response.data);
        })
        .catch((error) => {
          console.error("Error fetching users:", error);
        });
    }
  }, [userId]); // This effect will run when userId changes

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  useEffect(() => {
    if (selectedUser && userId) {
      axios
        .get(`http://localhost:3000/getMessages/${userId}/${selectedUser.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        })
        .then((response) => {
          console.log(response.data);
          setMessages(response.data);
        })
        .catch((error) => console.error("Error fetching messages:", error));
    }
  }, [selectedUser, userId]);

  useEffect(() => {
    const pusher = new Pusher("33e2f92a4833d2732d79", { cluster: "ap1" });

    const channel = pusher.subscribe("chat");
    channel.bind("message", (data) => {
      if (selectedUser && data.sender_id === selectedUser.id) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { ...data, timestamp: new Date().toISOString() }, // Ensure timestamp is present
        ]);
        console.log(data);
      }
    });

    return () => {
      channel.unbind("message");
      channel.unsubscribe();
    };
  }, [selectedUser]);

  // Handle sending messages
  const sendMessage = () => {
    if (!message.trim() && !file) return;

    const formData = new FormData();
    formData.append("sender_id", userId);
    formData.append("receiver_id", selectedUser.id);
    formData.append("message", message);
    if (file) {
      formData.append("attachment", file);
    }

    axios
      .post("http://localhost:3000/sendMessage", formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((response) => {
        setMessages([...messages, response.data]);
        setMessage("");
        setFile(null);
      })
      .catch((error) => console.error("Error sending message:", error));
  };

  // Filter users based on search input
  const filteredUsers = users.filter((user) =>
    user.fullname.toLowerCase().includes(search.toLowerCase())
  );
  const handleDownload = (fileUrl, fileName) => {
    fetch(fileUrl)
      .then((response) => response.blob()) // Convert to Blob
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName; // Set the file name
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      })
      .catch((error) => console.error("Download failed:", error));
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-5">
        <div className="row clearfix">
          <div className="col-lg-12">
            <div className="card chat-app">
              <div id="plist" className="people-list">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <ul className="list-unstyled chat-list mt-2 mb-0">
                  {filteredUsers.map((user) => (
                    <li
                      key={user.id}
                      className={`clearfix ${
                        selectedUser?.id === user.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <img
                        src="https://img.freepik.com/free-psd/contact-icon-illustration-isolated_23-2151903337.jpg"
                        alt="avatar"
                      />
                      <div className="about">
                        <div className="name">{user.fullname}</div>
                        <small className="email text-secondary">
                          {user.email}
                        </small>
                      </div>
                    </li>
                  ))}
                  {filteredUsers.length === 0 && (
                    <li className="text-center mt-3">No users found</li>
                  )}
                </ul>
              </div>

              <div className="chat">
                {selectedUser ? (
                  <>
                    <div className="chat-header clearfix">
                      <div className="row">
                        <div className="col-lg-6">
                          <img
                            src="https://img.freepik.com/free-psd/contact-icon-illustration-isolated_23-2151903337.jpg"
                            alt="avatar"
                          />
                          <div className="chat-about">
                            <h6 className="m-b-0">{selectedUser.fullname}</h6>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="chat-history">
                      <ul className="m-b-0">
                        {messages.map((msg, index) => (
                          <li
                            key={index}
                            className={`clearfix ${
                              msg.sender_id === userId ? "text-right" : ""
                            }`}
                          >
                            <div className="message-data">
                              <span className="message-data-time">
                                {formatTimestamp(msg.timestamp)}
                              </span>
                            </div>
                            <div
                              className={`message ${
                                msg.sender_id === userId
                                  ? "my-message"
                                  : "other-message"
                              }`}
                            >
                              {msg.message}
                              {msg.attachment && (
                                <div className="attachment">
                                  {/\.(jpg|jpeg|png|gif|webp)$/i.test(
                                    msg.attachment
                                  ) ? (
                                    <div>
                                      <img
                                        src={`http://localhost:3000/uploads/${msg.attachment}`}
                                        alt="attachment"
                                        className="attachment-preview"
                                        style={{
                                          maxWidth: "200px",
                                          borderRadius: "5px",
                                          cursor: "pointer",
                                        }}
                                        onClick={() =>
                                          window.open(
                                            `http://localhost:3000/uploads/${msg.attachment}`,
                                            "_blank"
                                          )
                                        }
                                      />
                                      <br />
                                      <button
                                        onClick={() =>
                                          handleDownload(
                                            `http://localhost:3000/uploads/${msg.attachment}`,
                                            msg.attachment
                                          )
                                        }
                                        className="download-button"
                                        style={{
                                          marginTop: "5px",
                                          backgroundColor: "#007bff",
                                          color: "white",
                                          padding: "5px 10px",
                                          border: "none",
                                          borderRadius: "5px",
                                          cursor: "pointer",
                                        }}
                                      >
                                        ⬇ Download Image
                                      </button>
                                    </div>
                                  ) : (
                                    <a
                                      href={`http://localhost:3000/uploads/${msg.attachment}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      style={{
                                        color: "#007bff",
                                        textDecoration: "none",
                                      }}
                                    >
                                      {msg.attachment}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="chat-message clearfix">
                      <div className="input-group mb-0">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter text here..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                        <input
                          type="file"
                          className="form-control"
                          onChange={(e) => setFile(e.target.files[0])}
                        />

                        <div className="input-group-append">
                          <button
                            className="btn btn-primary"
                            onClick={sendMessage}
                          >
                            <IoIosSend />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center mt-5">
                    <h5>Select a user to start chatting</h5>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
