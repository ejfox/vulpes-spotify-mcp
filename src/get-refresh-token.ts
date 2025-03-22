#!/usr/bin/env node

/**
 * This is a helper script to generate a refresh token for Spotify API access.
 * 
 * To use it:
 * 1. Create a Spotify application at https://developer.spotify.com/dashboard/
 * 2. Add http://localhost:8888/callback as a redirect URI in the app settings
 * 3. Set the SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables
 * 4. Run this script
 * 5. Follow the instructions to authorize your application
 * 6. Copy the refresh token to your .env file
 */

import SpotifyWebApi from 'spotify-web-api-node';
import express from 'express';
import { config } from 'dotenv';
import { randomBytes } from 'crypto';

config();

const PORT = 8888;
const STATE_KEY = 'spotify_auth_state';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative'
];

// Create Spotify API instance
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: `http://localhost:${PORT}`
});

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error('Error: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  process.exit(1);
}

const app = express();

app.get('/login', (req, res) => {
  const state = randomBytes(16).toString('hex');
  res.cookie(STATE_KEY, state);

  // Redirect to Spotify authorization page
  const authorizeURL = spotifyApi.createAuthorizeURL(SCOPES, state);
  res.redirect(authorizeURL);
});

app.get('/', async (req, res) => {
  const { code, state } = req.query;

  try {
    // Exchange the authorization code for tokens
    const data = await spotifyApi.authorizationCodeGrant(code as string);
    
    const accessToken = data.body.access_token;
    const refreshToken = data.body.refresh_token;
    
    // Display the tokens
    res.send(`
      <h1>Authorization Successful</h1>
      <p>Please add the following refresh token to your .env file:</p>
      <pre>SPOTIFY_REFRESH_TOKEN=${refreshToken}</pre>
      <p><strong>Note:</strong> Keep this token secret!</p>
    `);
    
    console.log('Authorization successful!');
    console.log('Refresh token:', refreshToken);
    
    // Close the server after a delay to allow the response to be sent
    setTimeout(() => {
      server.close(() => {
        console.log('Server closed. You can close this window now.');
        process.exit(0);
      });
    }, 2000);
    
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.send('Error acquiring tokens. Check the console for details.');
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`

  ===== Spotify API Authorization =====
  
  1. Visit http://localhost:${PORT}/login in your browser
  2. Log in to Spotify and authorize this application
  3. Copy the refresh token that appears and add it to your .env file
  
  `);
});