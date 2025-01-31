import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import Swal from "sweetalert2";

const CustomNavbar = () => {
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
        const response = await fetch(`${import.meta.env.VITE_MAIN_URL}/getuserinfo`, {
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
    <Navbar bg="light" expand="lg" className="shadow-sm">
      <Container>
        <Navbar.Brand as={Link} to="/">
          Omni-Channel Communication
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link as={Link} to="/dashboard" active={location.pathname === "/dashboard"}>
              Home
            </Nav.Link>
            <Nav.Link as={Link} to="/chat" active={location.pathname === "/chat"}>
              Chat
            </Nav.Link>
            <Nav.Link as={Link} to="/voice" active={location.pathname === "/voice"}>
              Voice
            </Nav.Link>
            <Nav.Link as={Link} to="/email" active={location.pathname === "/email"}>
              Email
            </Nav.Link>
            <Nav.Link as={Link} to="/sms" active={location.pathname === "/sms"}>
              SMS
            </Nav.Link>
            <Button variant="danger" className="ms-2" onClick={handleLogout}>
              Logout
            </Button>
            <Navbar.Text className="ms-3">Name: {fullname}</Navbar.Text>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default CustomNavbar;
