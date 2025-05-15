# Vuples Spotify MCP Server

[![smithery badge](https://smithery.ai/badge/@ejfox/vulpes-spotify-mcp)](https://smithery.ai/server/@ejfox/vulpes-spotify-mcp)

A Model Context Protocol (MCP) server that enables AI assistants like Claude to interact with Spotify, allowing them to search for and play tracks.

## Features

- Search for tracks by artist, title, or any query
- Play tracks directly on your active Spotify device
- Get information about your currently playing track
- Find available Spotify playback devices
- Combined search-and-play functionality
- List user's Spotify playlists
- View tracks within playlists
- Play playlists (with optional shuffle mode)
- Find and play playlists by name

## Requirements

- Node.js (v16+)
- Spotify Developer Account
- Spotify Premium account (for playback functionality)
- An MCP-compatible client (e.g., Claude Desktop)

## Installation

### Installing via Smithery

To install Vulpes Spotify Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@ejfox/vulpes-spotify-mcp):

```bash
npx -y @smithery/cli install @ejfox/vulpes-spotify-mcp --client claude
```

### Manual Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/spotify-mcp.git
   cd spotify-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Spotify API credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:8888
   
   # Optional: For playback control
   SPOTIFY_REFRESH_TOKEN=your_refresh_token
   ```

   You can get your Client ID and Secret from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications).

4. Generate a refresh token (required for playback control):

   There are two ways to get a refresh token:

   **Option 1: Use the built-in script**
   ```bash
   npm run get-token
   ```
   This will start a local server and provide instructions in the terminal.
   
   **Option 2: Use the simple script (if option 1 doesn't work)**
   ```bash
   node src/simple-auth.js
   ```
   This will give you a URL to open in your browser. After authorizing, you'll be redirected to a URL. Copy that URL back to the terminal, and it will show you a curl command to get the refresh token.

   Required scopes (already included in the scripts):
   - `user-read-playback-state`
   - `user-modify-playback-state`
   - `user-read-currently-playing`
   - `playlist-read-private`
   - `playlist-read-collaborative`

5. Add the refresh token to your `.env` file:
   ```
   SPOTIFY_REFRESH_TOKEN=your_refresh_token
   ```

6. Build the project:
   ```bash
   npm run build
   ```

## Usage with Claude Desktop

1. First, ensure Spotify is open and playing on your device

2. Add this server to your Claude Desktop configuration:

   Edit your `claude_desktop_config.json` file (typically in `~/Library/Application Support/Claude/` on macOS or `%APPDATA%\\Claude\\` on Windows):

   ```json
   {
     "mcpServers": {
       "spotify": {
         "command": "node",
         "args": ["/absolute/path/to/vulpes-spotify-mcp/dist/index.js"],
         "env": {
           "SPOTIFY_CLIENT_ID": "your_client_id",
           "SPOTIFY_CLIENT_SECRET": "your_client_secret",
           "SPOTIFY_REDIRECT_URI": "http://localhost:8888",
           "SPOTIFY_REFRESH_TOKEN": "your_refresh_token"
         }
       }
     }
   }
   ```

   Make sure to replace `/absolute/path/to/vulpes-spotify-mcp` with the actual path to your project.

3. Restart Claude Desktop

4. You should now see the Spotify tools available when you click on the hammer icon in Claude Desktop

## Available Tools

- **spotify-search**: Search for tracks by query
- **spotify-play**: Play a specific track by ID or URI
- **spotify-currently-playing**: Get information about the currently playing track
- **spotify-devices**: List available Spotify playback devices
- **spotify-search-and-play**: Search for a track and automatically play the top result
- **spotify-playlists**: Get a list of the user's Spotify playlists
- **spotify-playlist-tracks**: Get tracks from a specific playlist
- **spotify-play-playlist**: Play a specific playlist (with optional shuffle)
- **spotify-find-playlist**: Find a playlist by name and play it (recommended for AI use)

## Troubleshooting

- **"No active device found"**: Make sure Spotify is open and playing on at least one of your devices
- **"Missing permissions"**: Your refresh token may not have the required scopes
- **"Not premium"**: Playback control requires a Spotify Premium account
- **"Issues with refresh token"**: If your token expires, generate a new one using the steps in the installation section

## Important Notes

1. Always ensure Spotify is open on at least one device before using playback controls
2. The refresh token in your `.env` file and Claude Desktop config must match
3. After making changes to your configuration, restart Claude Desktop

## License

MIT
