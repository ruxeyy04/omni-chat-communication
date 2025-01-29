import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";
import "bootstrap/dist/css/bootstrap.min.css";
import Navbar from "../Components/Navbar";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";

const CLIENT_ID =
  "848428458188-ccqkntdb39k5gnjq6ftb9rftbrb1ssb1.apps.googleusercontent.com";
const API_KEY = "AIzaSyACbfsltD_C7ymw2aYHFZKHrDQUbjcZ8lc";
const SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";

const Email = () => {
  const [emails, setEmails] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [compose, setCompose] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  });
  const [nextPageToken, setNextPageToken] = useState(null);
  const [prevPageToken, setPrevPageToken] = useState(null);
  const getEmailBody = (email) => {
    if (!email?.payload) return "No message content.";

    // Check if the body exists directly (may contain plain or HTML content)
    if (email.payload.body?.data) {
      // Attempt to decode Base64 if there is any data
      return decodeBase64(email.payload.body.data);
    }

    // Handle multipart messages and prefer HTML content
    if (email.payload.parts) {
      let htmlContent = ""; // Store HTML content

      for (const part of email.payload.parts) {
        // Look for 'text/html' type first
        if (part.mimeType === "text/html" && part.body?.data) {
          htmlContent = decodeBase64(part.body.data); // Get HTML content
          break;
        }
        // Fallback to plain text if no HTML
        else if (part.mimeType === "text/plain" && part.body?.data) {
          htmlContent = decodeBase64(part.body.data); // Get plain text content
        }
      }

      if (htmlContent) {
        return htmlContent; // Return HTML or text content
      }
    }

    return "No readable message content.";
  };

  // Helper function to decode Base64 (including handling URL-safe encoding)
  const decodeBase64 = (str) => {
    try {
      // Decode base64 data (ensure URL-safe characters are converted)
      const decoded = atob(str.replace(/_/g, "/").replace(/-/g, "+"));
      return decoded;
    } catch (e) {
      console.error("Base64 decode error: ", e);
      return "Failed to decode message.";
    }
  };

  useEffect(() => {
    function start() {
      gapi.client
        .init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest",
          ],
        })
        .then(() => {
          const authInstance = gapi.auth2.getAuthInstance();
          setIsAuthenticated(authInstance.isSignedIn.get());
          authInstance.isSignedIn.listen(setIsAuthenticated);
          if (authInstance.isSignedIn.get()) {
            fetchEmails();
          }
        });
    }
    gapi.load("client:auth2", start);
  }, []);

  const handleLogin = async () => {
    const authInstance = gapi.auth2.getAuthInstance();
    await authInstance.signIn();
    setIsAuthenticated(true);
    fetchEmails();
  };

  const handleLogout = () => {
    gapi.auth2.getAuthInstance().signOut();
    setIsAuthenticated(false);
    setEmails([]);
  };

  // Add these functions after your existing state declarations

  const downloadAttachment = async (
    messageId,
    attachmentId,
    filename,
    mimeType
  ) => {
    try {
      const response = await gapi.client.gmail.users.messages.attachments.get({
        userId: "me",
        messageId: messageId,
        id: attachmentId,
      });

      // Convert from base64url to base64
      const base64Data = response.result.data
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      // Create blob and trigger download
      const binaryData = atob(base64Data);
      const byteArray = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        byteArray[i] = binaryData.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: mimeType });

      // Create and trigger download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      alert("Failed to download attachment: " + error.message);
    }
  };

// First, add a state to track the current page history
const [pageHistory, setPageHistory] = useState([]);

// Update the fetchEmails function
const fetchEmails = async (pageToken = "", isNextPage = true) => {
  try {
    const response = await gapi.client.gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: 10,
      pageToken: pageToken || undefined,
    });

    if (response.result.messages) {
      const emailData = await Promise.all(
        response.result.messages.map(async (msg) => {
          const email = await gapi.client.gmail.users.messages.get({
            userId: "me",
            id: msg.id,
          });
          return email.result;
        })
      );

      setEmails(emailData);
      
      // Update page history and tokens
      if (isNextPage && pageToken) {
        setPageHistory(prev => [...prev, pageToken]);
      } else if (!isNextPage) {
        setPageHistory(prev => prev.slice(0, -1));
      }

      setNextPageToken(response.result.nextPageToken || null);
      // Set prevPageToken based on page history
      setPrevPageToken(pageHistory.length > 0 ? pageHistory[pageHistory.length - 1] : null);
    } else {
      setEmails([]);
      setNextPageToken(null);
      setPrevPageToken(null);
    }
  } catch (error) {
    console.error("Error fetching emails:", error);
    alert("Failed to fetch emails: " + error.message);
  }
};

// Update the handleNextPage function
const handleNextPage = () => {
  if (nextPageToken) {
    fetchEmails(nextPageToken, true);
  }
};

// Update the handlePrevPage function
const handlePrevPage = () => {
  const previousToken = pageHistory[pageHistory.length - 1];
  if (previousToken) {
    fetchEmails(previousToken, false);
  }
};


  const sendEmail = async () => {
    const authInstance = gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) {
      alert("Please sign in first!");
      return;
    }

    const { to, cc, bcc, subject, body } = compose;
    if (!to) {
      alert("Recipient email is required.");
      return;
    }

    const boundary = `----=_Part_${Date.now().toString(16)}`;
    let emailParts = [];

    // Email headers
    emailParts.push(
      `From: me`,
      `To: ${to}`,
      cc ? `Cc: ${cc}` : null,
      bcc ? `Bcc: ${bcc}` : null,
      `Subject: ${subject || "(no subject)"}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      `${body || ""}`,
      ``
    );

    // Filter out null values
    emailParts = emailParts.filter((part) => part !== null);

    try {
      if (attachment && attachment instanceof File) {
        // Verify attachment is a File object
        // Convert File to ArrayBuffer
        const arrayBuffer = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsArrayBuffer(attachment);
        });

        // Convert ArrayBuffer to base64
        const base64Data = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        emailParts.push(
          `--${boundary}`,
          `Content-Type: ${
            attachment.type || "application/octet-stream"
          }; name="${attachment.name}"`,
          `Content-Disposition: attachment; filename="${attachment.name}"`,
          `Content-Transfer-Encoding: base64`,
          ``,
          base64Data,
          ``,
          `--${boundary}--`
        );
      } else {
        emailParts.push(`--${boundary}--`, "");
      }

      const emailContent = emailParts.join("\r\n");
      const base64EncodedEmail = btoa(
        unescape(encodeURIComponent(emailContent))
      )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      await gapi.client.gmail.users.messages.send({
        userId: "me",
        resource: { raw: base64EncodedEmail },
      });

      alert("Email sent successfully!");
      setCompose({ to: "", cc: "", bcc: "", subject: "", body: "" });
      setAttachment(null);
      setShowModal(false);
    } catch (error) {
      console.error("Error sending email:", error);
      alert("Failed to send email: " + error.message);
    }
  };

  // Add this function to handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Verify it's a valid file
      if (file instanceof File) {
        setAttachment(file);
      } else {
        alert("Invalid file selected");
      }
    }
  };
  const [attachment, setAttachment] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        setAttachment({ name: file.name, data: reader.result.split(",")[1] });
      };
    }
  };
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const openEmailModal = (email) => {
    setSelectedEmail(email);
    setShowEmailModal(true);
  };

  return (
    <div className="container mt-4">
      <Navbar />
      <nav className="navbar navbar-light bg-light mb-3">
        <span className="navbar-brand mx-3">Email Client</span>
        <div>
          {isAuthenticated ? (
            <button className="btn btn-danger" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleLogin}>
              Login
            </button>
          )}
        </div>
      </nav>

      <div className="row">
        {/* Inbox Section */}
        <div className="col-md-12">
          <h5>Inbox</h5>
          {isAuthenticated ? (
            <>
              <button
                className="btn btn-secondary mb-2"
                onClick={() => {
                  setNextPageToken(null);
                  setPrevPageToken(null);
                  fetchEmails();
                }}
              >
                Refresh Inbox
              </button>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Sender</th>
                    <th>Subject</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.length > 0 ? (
                    emails.map((email, index) => (
                      <tr
                        key={index}
                        onClick={() => openEmailModal(email)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          {
                            email.payload.headers.find((h) => h.name === "From")
                              ?.value
                          }
                        </td>
                        <td>
                          {
                            email.payload.headers.find(
                              (h) => h.name === "Subject"
                            )?.value
                          }
                        </td>
                        <td>
                          {new Date(
                            email.internalDate * 1
                          ).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center">
                        No emails found
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
              <div className="d-flex justify-content-center gap-2 mt-3">
                <button
                  className="btn btn-primary"
                  onClick={handlePrevPage}
                  disabled={pageHistory.length === 0}
                >
                  ← Previous
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleNextPage}
                  disabled={!nextPageToken}
                >
                  Next →
                </button>
              </div>
            </>
          ) : (
            <p>Please log in to view your inbox.</p>
          )}
        </div>

        {/* Compose Section */}
        <div className="col-md-6">
          <h5>Compose Email</h5>
          {isAuthenticated && (
            <Button variant="success" onClick={() => setShowModal(true)}>
              New Email
            </Button>
          )}
        </div>
      </div>

      {/* Compose Email Modal using React-Bootstrap */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>New Email</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <input
            type="email"
            className="form-control mb-2"
            placeholder="To"
            value={compose.to}
            onChange={(e) => setCompose({ ...compose, to: e.target.value })}
          />
          <input
            type="email"
            className="form-control mb-2"
            placeholder="CC"
            value={compose.cc}
            onChange={(e) => setCompose({ ...compose, cc: e.target.value })}
          />
          <input
            type="email"
            className="form-control mb-2"
            placeholder="BCC"
            value={compose.bcc}
            onChange={(e) => setCompose({ ...compose, bcc: e.target.value })}
          />
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Subject"
            value={compose.subject}
            onChange={(e) =>
              setCompose({ ...compose, subject: e.target.value })
            }
          />
          <textarea
            className="form-control mb-2"
            rows="5"
            placeholder="Message"
            value={compose.body}
            onChange={(e) => setCompose({ ...compose, body: e.target.value })}
          ></textarea>
          <input
            type="file"
            className="form-control mb-2"
            onChange={handleFileSelect}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={sendEmail}>
            Send
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Inbox Email */}
      <Modal
        size="lg"
        show={showEmailModal}
        onHide={() => setShowEmailModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Email Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEmail && (
            <>
              <p>
                <strong>From: </strong>
                {
                  selectedEmail.payload.headers.find((h) => h.name === "From")
                    ?.value
                }
              </p>
              <p>
                <strong>Subject: </strong>
                {
                  selectedEmail.payload.headers.find(
                    (h) => h.name === "Subject"
                  )?.value
                }
              </p>
              <p>
                <strong>Date: </strong>
                {new Date(selectedEmail.internalDate * 1).toLocaleString()}
              </p>
              <hr />
              {/* Render the HTML email content */}
              <div
                dangerouslySetInnerHTML={{
                  __html: getEmailBody(selectedEmail),
                }}
              />

              {/* Attachments */}
              {selectedEmail.payload.parts?.map((part, index) => {
                if (part.filename && part.body.attachmentId) {
                  return (
                    <div key={index} className="mt-2">
                      <Button
                        variant="link"
                        onClick={() =>
                          downloadAttachment(
                            selectedEmail.id,
                            part.body.attachmentId,
                            part.filename,
                            part.mimeType
                          )
                        }
                      >
                        📎 {part.filename}
                      </Button>
                    </div>
                  );
                }
                return null;
              })}
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Email;
