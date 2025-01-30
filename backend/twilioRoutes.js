const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

const client = twilio(accountSid, authToken);

// Generate token for Twilio Client
router.get('/api/twilio/token', (req, res) => {
  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true
    });

    const token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { 
        identity: 'user-name',
        ttl: 3600
      }
    );

    token.addGrant(voiceGrant);
    res.json({ token: token.toJwt() });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Handle voice requests for both browser client and regular calls
router.post('/api/twilio/voice', (req, res) => {
  const twiml = new VoiceResponse();
  
  try {
    console.log('Voice webhook received:', req.body);
    
    // Check if the call is from a browser client
    if (req.body.From && req.body.From.includes('client')) {
      // Handle browser-initiated calls
      const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER,
        // Enable call recording if needed
        record: 'record-from-answer',
        // Enable call transcription if needed
        transcribe: true,
        // Hangup callback to handle call ending
        action: '/api/twilio/call-status'
      });
      
      dial.number(req.body.To);
    } else {
      // Handle incoming calls to the browser
      const dial = twiml.dial({
        callerId: req.body.From
      });
      dial.client('user-name');
    }

    console.log('Generated TwiML:', twiml.toString());
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('TwiML Error:', error);
    twiml.say('An error occurred. Please try again later.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Make outbound call - handles both regular calls and browser client calls
router.post('/api/twilio/make-call', async (req, res) => {
  try {
    const { to } = req.body;
    
    const call = await client.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
      url: "http://demo.twilio.com/docs/voice.xml",
    });
  
    console.log(call.sid);
 
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle call status updates and call ending
router.post('/api/twilio/call-status', (req, res) => {
  console.log('Call Status Update:', req.body);
  
  // You can handle specific call statuses here
  const callStatus = req.body.CallStatus;
  const callSid = req.body.CallSid;
  
  if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed' || callStatus === 'canceled') {
    // Call has ended - you can perform cleanup here
    console.log(`Call ${callSid} ended with status: ${callStatus}`);
  }
  
  res.sendStatus(200);
});

// Add an endpoint to end calls
router.post('/api/twilio/end-call', async (req, res) => {
  try {
    const { callSid } = req.body;
    
    if (!callSid) {
      return res.status(400).json({ error: 'CallSid is required' });
    }

    // End the call using Twilio API
    await client.calls(callSid)
      .update({ status: 'completed' });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;