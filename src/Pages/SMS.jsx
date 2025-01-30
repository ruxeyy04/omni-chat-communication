import React, { useCallback, useEffect, useState } from "react";
import Navbar from "../Components/Navbar";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Badge from "react-bootstrap/Badge";
import ListGroup from "react-bootstrap/ListGroup";
import axios from "axios";
import Pusher from "pusher-js";

const SMS = () => {
  const [phonenumber, setPhonenumber] = useState("");
  const [conversations, setConversations] = useState([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newMessage, setNewMessage] = useState("");
  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        return Swal.fire(
          "Error",
          "No token found, please login again.",
          "error"
        );
      }

      try {
        const response = await fetch("http://localhost:3000/getuserinfo", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }, // Include the token in the Authorization header
        });

        const result = await response.json();

        if (response.ok) {
          setPhonenumber(result.contact);
        } else {
          Swal.fire("Error", result.message, "error");
        }
      } catch (error) {
        Swal.fire(
          "Error",
          "Something went wrong while fetching user data!",
          "error"
        );
      }
    };

    fetchUserData();
  }, []);

  // Extract fetchConversations into its own function using useCallback
  const fetchConversations = useCallback(async () => {
    if (!phonenumber) return;

    try {
      const response = await axios.get(
        `http://localhost:3000/getcontacthistory/${phonenumber}`
      );
      setConversations(response.data);
    } catch (error) {
      console.error("Error fetching SMS history:", error);
    }
  }, [phonenumber]);

  // Initial fetch of conversations
  useEffect(() => {
    console.log(selectedNumber)
    fetchConversations();
  }, [phonenumber, fetchConversations]);

  // Set up Pusher subscription
  useEffect(() => {
    if (!phonenumber) return;

    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: "ap1",
    });

    const channel = pusher.subscribe("sms");

    channel.bind("convo", (data) => {
      setSelectedNumber(data.phonenumber)
      fetchMessageHistory(phonenumber, data.phonenumber);
      fetchConversations();
    });

    // Cleanup function
    return () => {
      channel.unbind("convo");
      pusher.unsubscribe("sms");
      pusher.disconnect();
    };
  }, [phonenumber, fetchConversations]);



  const sendMessage = () => {
    if (!input.trim() && !attachment) return;

    const formData = new FormData();
    formData.append("sender_id", phonenumber);
    formData.append("receiver_id", selectedNumber);
    formData.append("message", input);
    if (attachment) {
      formData.append("attachment", attachment);
    }

    axios
      .post("http://localhost:3000/msgcompose", formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((response) => {
        const messageData = response.data; // Backend response with message details

        // Format attachment URL if available
        const attachmentUrl = messageData.attachment
          ? `${messageData.attachment}`
          : null;

        setMessages((prevMessages) => [
          ...prevMessages,
          {
            text: input,
            sender: phonenumber,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "numeric", // Use numeric without leading zero
              minute: "2-digit",
              hour12: true, // Use 12-hour format (AM/PM)
            }),
            attachment: attachmentUrl,
          },
        ]);

        // Check if the number already exists in conversations
        const isExistingConversation = conversations.some(
          (conv) => conv.number === newNumber
        );

        if (!isExistingConversation) {
          conversations.push({ number: newNumber });
        }

        setInput("");
        setAttachment(null);
      })
      .catch((error) => console.error("Error sending message:", error));
  };
  const [messages, setMessages] = useState([]); // To store the message history

  // Function to fetch message history when a number is selected
  const fetchMessageHistory = (senderId, receiverId) => {
    axios
      .get(`http://localhost:3000/getmsghistory/${senderId}/${receiverId}`)
      .then((response) => {
        setMessages(response.data); // Set the message history
      })
      .catch((error) => {
        console.error("Error fetching message history:", error);
      });
  };

  useEffect(() => {
    // When selectedNumber changes, fetch the message history
    if (selectedNumber) {
      fetchMessageHistory(phonenumber, selectedNumber); // phonenumber is the sender's ID
    }
  }, [selectedNumber]); // Re-run the effect when the selectedNumber changes

  const handleComposeSend = () => {
    if (!newMessage.trim() && !attachment) return;

    const formData = new FormData();
    formData.append("sender_id", phonenumber);
    formData.append("receiver_id", newNumber);
    formData.append("message", newMessage);
    if (attachment) {
      formData.append("attachment", attachment);
    }

    axios
      .post("http://localhost:3000/msgcompose", formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((response) => {
        const messageData = response.data; // Backend response with message details

        // Format attachment URL if available
        const attachmentUrl = messageData.attachment
          ? `${messageData.attachment}`
          : null;

        setMessages((prevMessages) => [
          ...prevMessages,
          {
            text: newMessage,
            sender: phonenumber,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            attachment: attachmentUrl,
          },
        ]);

        // Check if the number already exists in conversations
        const isExistingConversation = conversations.some(
          (conv) => conv.number === newNumber
        );

        if (!isExistingConversation) {
          conversations.push({ number: newNumber });
        }

        setSelectedNumber(newNumber);
        setShowComposeModal(false);
        setNewNumber("");
        setNewMessage("");
      })
      .catch((error) => console.error("Error sending message:", error));
  };

  return (
    <>
      <Navbar />
      <div className="container-fluid">
        <div className="row">
          {/* Conversations Sidebar */}
          <div className="col-md-4 border-end p-3 bg-light">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">SMS Messages</h5>
              <Button
                variant="primary"
                onClick={() => setShowComposeModal(true)}
              >
                New Message
              </Button>
            </div>
            <ListGroup>
              {conversations.map((chat, index) => (
                <ListGroup.Item
                  key={index}
                  action
                  active={selectedNumber === chat.number}
                  onClick={() => setSelectedNumber(chat.number)}
                  className="d-flex justify-content-between align-items-center"
                >
                  {chat.number}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>

          {/* Chat Window */}
          <div className="col-md-8 p-3">
            {selectedNumber ? (
              <>
                <h5 className="mb-3">Message to {selectedNumber}</h5>
                <div
                  className="border rounded p-3 mb-3"
                  style={{ height: "500px", overflowY: "auto" }}
                >
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`d-flex mb-3 ${
                        msg.sender === phonenumber
                          ? "justify-content-end"
                          : "justify-content-start"
                      }`}
                    >
                      <div
                        className={`d-flex flex-column ${
                          msg.sender === phonenumber
                            ? "align-items-end"
                            : "align-items-start"
                        }`}
                        style={{ maxWidth: "70%" }}
                      >
                        <div
                          className={`p-3 rounded ${
                            msg.sender === phonenumber
                              ? "bg-primary text-white"
                              : "bg-light border"
                          }`}
                        >
                          <p className="mb-1">{msg.text || msg.message}</p>
                          {msg.attachment && (
                            <>
                              {/* If the attachment is an image */}
                              {msg.attachment.match(
                                /\.(jpeg|jpg|gif|png)$/i
                              ) ? (
                                <img
                                  src={msg.attachment}
                                  alt="attachment"
                                  className="img-fluid rounded mt-2"
                                  style={{ maxWidth: "200px" }}
                                />
                              ) : (
                                // If the attachment is not an image, show a download link
                                <a
                                  href={msg.attachment}
                                  download
                                  className="btn btn-primary mt-2"
                                  style={{ display: "inline-block" }}
                                >
                                  Download {msg.attachment.split("/").pop()}{" "}
                                  {/* Display filename */}
                                </a>
                              )}
                            </>
                          )}
                        </div>
                        <small className="text-muted mt-1">
                          {msg.timestamp}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <div className="d-flex gap-2">
                  <Form.Control
                    type="file"
                    onChange={(e) => setAttachment(e.target.files[0])}
                    style={{ width: "500px" }}
                  />
                  <Form.Control
                    type="text"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button variant="primary" onClick={sendMessage}>
                    Send
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-center text-muted">
                Select a conversation or start a new one
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      <Modal show={showComposeModal} onHide={() => setShowComposeModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>New Message</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Phone Number</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter phone number"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Message</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Attachment File</Form.Label>
              <Form.Control
                type="file"
                onChange={(e) => setAttachment(e.target.files[0])}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowComposeModal(false)}
          >
            Close
          </Button>
          <Button variant="primary" onClick={handleComposeSend}>
            Send Message
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SMS;
