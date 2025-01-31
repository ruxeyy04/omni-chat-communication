import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Navbar from './Components/Navbar';

const Dashboard = () => {
  const [fullname, setFullname] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return Swal.fire('Error', 'No token found, please login again.', 'error');
      }
  
      try {
        const response = await fetch(`${import.meta.env.VITE_MAIN_URL}/getuserinfo`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'  }, // Include the token in the Authorization header
        });
  
        const result = await response.json();
  
        if (response.ok) {
          setFullname(result.fullname);
        } else {
          Swal.fire('Error', result.message, 'error');
        }
      } catch (error) {
        Swal.fire('Error', 'Something went wrong while fetching user data!', 'error');
      }
    };
  
    fetchUserData();
  }, []);
  

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('authToken'); // Remove JWT token
    navigate('/login'); // Redirect to login page
  };

  return (
    <div>
      {/* Navbar */}
      <Navbar fullname={fullname} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="container mt-5">
        <h1>Welcome, {fullname}</h1>
        <p>This is your dashboard where you can manage your messages, emails, and other settings.</p>
        <div className="row">
          <div className="col">
            <h3>Home</h3>
            <p>Dashboard homepage content goes here.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
