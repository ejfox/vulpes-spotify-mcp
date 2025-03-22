#!/usr/bin/env node

/**
 * Simple Spotify Authorization Script
 * Just visits the Spotify authorize URL with the correct scopes
 */

const CLIENT_ID = 'a1b810e82dda4306963eb40599ccc71b';
const REDIRECT_URI = 'http://localhost:8888';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative'
];

// Generate a random state
const state = Math.random().toString(36).substring(2, 15);

// Create the authorization URL
const authorizeURL = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&state=${state}`;

console.log(`
===== Spotify API Authorization =====

1. Visit this URL in your browser:
${authorizeURL}

2. Log in to Spotify and authorize the application
3. You'll be redirected to ${REDIRECT_URI}?code=XXXX
4. Copy the entire URL from your browser and paste it back here to extract the code
`);

// Read from stdin
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
  const input = data.toString().trim();
  
  if (input.includes('code=')) {
    // Extract the code from the URL
    const codeMatch = input.match(/code=([^&]+)/);
    if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1];
      console.log(`
Your authorization code is: ${code}

To get a refresh token, use this command:
curl -X POST "https://accounts.spotify.com/api/token" \\
     -H "Content-Type: application/x-www-form-urlencoded" \\
     -d "grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${CLIENT_ID}&client_secret=6cea195e72d94014b6aec4df0b1878c5"
`);
    } else {
      console.log('Could not extract code from the URL. Please try again.');
    }
  } else {
    console.log('Please paste the full URL containing the code parameter.');
  }
  
  // Exit after processing input
  process.exit(0);
});