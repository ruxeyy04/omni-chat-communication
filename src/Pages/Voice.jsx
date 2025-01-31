import React, { useState, useEffect } from "react";
import { Device } from "@twilio/voice-sdk";
import { Phone, XCircle } from "lucide-react";
import Navbar from "../Components/Navbar";
const PhoneDialer = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callerNumber, setCallerNumber] = useState("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [device, setDevice] = useState(null);
  const [currentConnection, setCurrentConnection] = useState(null);
  const [showCallingDialog, setShowCallingDialog] = useState(false);
  const [isOutgoingCall, setIsOutgoingCall] = useState(false);
  const [callStatus, setCallStatus] = useState("");
  // Preload audio files

  useEffect(() => {
    const setupDevice = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/twilio/token");
        const data = await response.json();

        const newDevice = new Device(data.token, {
          codecPreferences: ["opus", "pcmu"],
          enableRingingState: true,
        });

        await newDevice.register();

        // Handle incoming calls
        newDevice.on("incoming", (connection) => {
          // Check if this is not our own outbound call
          if (!isOutgoingCall) {
           
            handleIncomingCallEvent(connection);
          }
        });

        newDevice.on("registered", () => {
          console.log("Twilio device registered");
        });

        newDevice.on("error", (error) => {
          console.error("Twilio device error:", error);
          alert(`Call error: ${error.message}`);
        });

        setDevice(newDevice);
      } catch (error) {
        console.error("Failed to initialize Twilio device:", error);
        alert("Failed to initialize phone system");
      }
    };

    setupDevice();

    return () => {
      if (device) {
        device.destroy();
      }
    };
  }, []);

  const handleIncomingCallEvent = (connection) => {
    // Don't handle incoming events for outbound calls
    if (isOutgoingCall) {
      return;
    }

    setIsIncomingCall(true);
    setCallerNumber(connection.parameters.From);
    setCurrentConnection(connection);

    connection.on("accept", () => {
      setIsCallActive(true);
      setIsIncomingCall(false);
    });

    connection.on("disconnect", () => {
     
      cleanup();
    });

    connection.on("reject", () => {
      cleanup();
    });
  };

  const cleanup = () => {
    setIsCallActive(false);
    setIsIncomingCall(false);
    setCurrentConnection(null);
    setShowCallingDialog(false);
    setIsOutgoingCall(false);
    setCallStatus("");
  };

  const handleNumberClick = (number) => {
    if (isCallActive && currentConnection) {
      // Send DTMF tones during active call
      currentConnection.sendDigits(number.toString());
    }
    setPhoneNumber((prev) => prev + number);
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!phoneNumber || !device || isCallActive) return;
  
    try {
      setShowCallingDialog(true);
      setCallStatus("Initiating call...");
      setIsOutgoingCall(true); // Set this before initiating the call
  
      const response = await fetch(
        "http://localhost:3000/api/twilio/make-call",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: phoneNumber,
          }),
        }
      );
  
      if (!response.ok) {
        throw new Error("Failed to initiate call");
      }
  
      const data = await response.json();
      console.log("Call SID:", data.callSid);
  
      // Now set up the client-side connection for audio
      const connection = await device.connect({
        params: {
          To: phoneNumber,
          CallSid: data.callSid,
        },
      });
  
      // Handle connection events
      connection.on("accept", () => {
        setIsCallActive(true);
        setCallStatus("Connected");
      });
  
      connection.on("disconnect", () => {
        cleanup(); // cleanup will reset isOutgoingCall
      });
  
      connection.on("error", (error) => {
        console.error("Connection error:", error);
        cleanup(); // cleanup will reset isOutgoingCall
      });
  
      // Monitor call quality
      connection.on("warning", (warning) => {
        console.warn("Call quality warning:", warning);
        setCallStatus("Poor connection quality");
      });
  
      connection.on("warning-cleared", () => {
        setCallStatus("Connected");
      });
  
      setCurrentConnection(connection);
    } catch (error) {
      console.error("Failed to make call:", error);
      alert("Failed to place call. Please try again.");
      cleanup(); // cleanup will reset isOutgoingCall
    }
  };

  const handleEndCall = async () => {
    if (currentConnection) {
      try {
        // Disconnect the client-side connection
        currentConnection.disconnect();

        // If you need to explicitly end the call on the server side:
        await fetch("http://localhost:3000/api/twilio/end-call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            callSid: currentConnection.parameters.CallSid,
          }),
        });
      } catch (error) {
        console.error("Error ending call:", error);
      } finally {
        cleanup();
      }
    }
  };

  const handleIncomingCall = (accept) => {
    if (!currentConnection) return;

    if (accept) {
      currentConnection.accept();
    } else {
      currentConnection.reject();
      cleanup();
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-4">
            <div className="card shadow">
              <div className="card-body">
                <input
                  type="text"
                  className="form-control mb-3"
                  value={phoneNumber}
                  onChange={(e) => {
                    // Only allow digits, +, and spaces
                    const cleaned = e.target.value.replace(/[^\d\s+]/g, "");
                    setPhoneNumber(cleaned);
                  }}
                  placeholder="Enter phone number"
                />

                <div className="dialpad mb-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map((num) => (
                    <button
                      key={num}
                      className="btn btn-light m-1 dialpad-button"
                      onClick={() => handleNumberClick(num)}
                      disabled={isIncomingCall}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <div className="d-flex justify-content-between">
                  <button
                    className="btn btn-success w-75 me-2"
                    onClick={handleCall}
                    disabled={!phoneNumber || isCallActive || isIncomingCall}
                  >
                    <i className="bi bi-telephone-fill me-2"></i>
                    Call
                  </button>
                  <button
                    className="btn btn-danger w-25"
                    onClick={handleDelete}
                    disabled={!phoneNumber || isCallActive || isIncomingCall}
                  >
                    <i className="bi bi-backspace-fill"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Call Status Dialog */}
        {showCallingDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-lg p-6 w-80">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Call Status</h3>
                <p className="text-gray-700 mb-4">{phoneNumber}</p>
                <p className="text-blue-500 mb-4">{callStatus}</p>

                {isCallActive && (
                  <button
                    onClick={handleEndCall}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg"
                  >
                    End Call
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Incoming Call Dialog - Only show for incoming calls */}
        {isIncomingCall && !isOutgoingCall && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-lg p-6 w-80 max-w-full">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Incoming Call</h3>
                <p className="text-gray-700 mb-4">{callerNumber}</p>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => handleIncomingCall(true)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Answer
                  </button>
                  <button
                    onClick={() => handleIncomingCall(false)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Call Banner */}
        {isCallActive && (
          <div
            className="position-fixed top-0 start-0 w-100 p-3 bg-success text-white"
            style={{ zIndex: 1040 }}
          >
            <div className="container d-flex justify-content-between align-items-center">
              <span>Call in progress with {callerNumber || phoneNumber}</span>
              <button className="btn btn-danger" onClick={handleEndCall}>
                End Call
              </button>
            </div>
          </div>
        )}

        <style>
          {`
           .dialpad {
             display: grid;
             grid-template-columns: repeat(3, 1fr);
             gap: 0.5rem;
           }
           
           .dialpad-button {
             aspect-ratio: 1;
             font-size: 1.25rem;
           }
         `}
        </style>
      </div>
    </>
  );
};

export default PhoneDialer;
