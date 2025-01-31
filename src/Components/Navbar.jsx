import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [fullname, setFullname] = useState("");

  useEffect(() => {
    const storedFullname = localStorage.getItem("fullname");
    if (storedFullname) {
      setFullname(storedFullname);
      return;
    }

    const fetchUserData = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        return Swal.fire("Error", "No token found, please login again.", "error");
      }

      try {
        const response = await fetch("http://localhost:3000/getuserinfo", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();

        if (response.ok) {
          setFullname(result.fullname);
          localStorage.setItem("fullname", result.fullname);
        } else {
          Swal.fire("Error", result.message, "error");
        }
      } catch (error) {
        Swal.fire("Error", "Something went wrong while fetching user data!", "error");
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("fullname");
    navigate("/login");
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          Omni-Channel Communication
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === "/dashboard" ? "active" : ""}`} to="/dashboard">
                Home
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === "/chat" ? "active" : ""}`} to="/chat">
                Chat
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === "/voice" ? "active" : ""}`} to="/voice">
                Voice
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === "/email" ? "active" : ""}`} to="/email">
                Email
              </Link>
            </li>
            <li className="nav-item">
              <Link className={`nav-link ${location.pathname === "/sms" ? "active" : ""}`} to="/sms">
                SMS
              </Link>
            </li>
            <li className="nav-item">
              <button className="btn btn-danger" onClick={handleLogout}>
                Logout
              </button>
            </li>
            <li className="nav-item">
              <span className="nav-link">Name: {fullname}</span>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
