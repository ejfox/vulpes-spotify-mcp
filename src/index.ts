#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchTracks,
  playTrack,
  getCurrentlyPlaying,
  getDevices,
  getUserPlaylists,
  getPlaylistTracks,
  playPlaylist,
  debugSpotifyConfig,
} from "./spotify-client.js";

// Initialize the MCP server
const server = new McpServer({
  name: "spotify-mcp",
  version: "1.0.0",
});

// Define Spotify search tool
server.tool(
  "spotify-search",
  "Search for tracks on Spotify by query (artist, track name, etc.)",
  {
    query: z.string().describe("Search query (artist name, track name, etc.)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of results to return (default: 5)"),
  },
  async ({ query, limit }, extra) => {
    console.error(`Searching for tracks: ${query}`);
    const results = await searchTracks(query, limit);
    return {
      content: results,
    };
  }
);

// Define Spotify play tool
server.tool(
  "spotify-play",
  "Play a specific track by ID or URI",
  {
    trackId: z
      .string()
      .describe("Spotify track ID or URI (spotify:track:xxxx)"),
  },
  async ({ trackId }, extra) => {
    console.error(`Playing track: ${trackId}`);
    const result = await playTrack(trackId);
    return {
      content: result,
    };
  }
);

// Define get currently playing tool
server.tool(
  "spotify-currently-playing",
  "Get the currently playing track",
  {},
  async (_args, extra) => {
    console.error("Getting currently playing track");
    const result = await getCurrentlyPlaying();
    return {
      content: result,
    };
  }
);

// Define get devices tool
server.tool(
  "spotify-devices",
  "Get available Spotify playback devices",
  {},
  async (_args, extra) => {
    console.error("Getting available devices");
    const result = await getDevices();
    return {
      content: result,
    };
  }
);

// Define get playlists tool
server.tool(
  "spotify-playlists",
  "Get a list of the user's Spotify playlists",
  {
    limit: z
      .number()
      .optional()
      .describe("Maximum number of playlists to return (default: 20)"),
  },
  async ({ limit }, extra) => {
    console.error(`Getting user playlists, limit: ${limit || 20}`);
    const result = await getUserPlaylists(limit);
    return {
      content: result,
    };
  }
);

// Define get playlist tracks tool
server.tool(
  "spotify-playlist-tracks",
  "Get tracks from a specific playlist",
  {
    playlistId: z.string().describe("Spotify playlist ID or URI"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of tracks to return (default: 50)"),
  },
  async ({ playlistId, limit }, extra) => {
    console.error(`Getting tracks for playlist: ${playlistId}`);
    const result = await getPlaylistTracks(playlistId, limit);
    return {
      content: result,
    };
  }
);

// Define play playlist tool
server.tool(
  "spotify-play-playlist",
  "Play a specific playlist (with optional shuffle)",
  {
    playlistId: z.string().describe("Spotify playlist ID or URI"),
    shuffle: z
      .boolean()
      .optional()
      .describe("Whether to play in shuffle mode (default: false)"),
  },
  async ({ playlistId, shuffle }, extra) => {
    console.error(
      `Playing playlist: ${playlistId}, shuffle: ${shuffle || false}`
    );
    const result = await playPlaylist(playlistId, shuffle);
    return {
      content: result,
    };
  }
);

// Define a combined search and play tool (convenient for AI to use)
server.tool(
  "spotify-search-and-play",
  "Search for a track and play the top result",
  {
    query: z.string().describe("Search query (artist name, track name, etc.)"),
  },
  async ({ query }, extra) => {
    console.error(`Searching and playing top result for: ${query}`);

    // First search for tracks
    const searchResults = await searchTracks(query, 1);

    // Check if we found any tracks
    if (
      searchResults.length === 0 ||
      searchResults[0].text === "No tracks found matching your query."
    ) {
      return {
        content: [
          {
            type: "text",
            text: `No tracks found matching "${query}"`,
            [Symbol.for("any")]: true,
          },
        ],
      };
    }

    try {
      // Parse the first result to get track ID
      const track = JSON.parse(searchResults[0].text);

      // Play the track
      const playResult = await playTrack(track.id);

      return {
        content: [
          {
            type: "text",
            text: `Found and playing: "${track.name}" by ${track.artist}`,
            [Symbol.for("any")]: true,
          },
        ],
      };
    } catch (error) {
      console.error("Error in search-and-play:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error trying to play track: ${error}`,
            [Symbol.for("any")]: true,
          },
        ],
      };
    }
  }
);

// Define a convenience tool to find and play a playlist
server.tool(
  "spotify-find-playlist",
  "Find a playlist by name and play it (with optional shuffle)",
  {
    name: z.string().describe("Name of playlist to search for"),
    shuffle: z
      .boolean()
      .optional()
      .describe("Whether to play in shuffle mode (default: false)"),
  },
  async ({ name, shuffle }, extra) => {
    console.error(`Finding and playing playlist containing: ${name}`);

    try {
      // First get all user playlists
      const playlistsResult = await getUserPlaylists(50);

      if (
        playlistsResult.length === 0 ||
        playlistsResult[0].text === "No playlists found."
      ) {
        return {
          content: [
            {
              type: "text",
              text: "No playlists found for your account.",
              [Symbol.for("any")]: true,
            },
          ],
        };
      }

      // Parse playlists and find matches
      const playlists = JSON.parse(playlistsResult[0].text);

      // Look for playlists that contain the search term (case-insensitive)
      const searchTerm = name.toLowerCase();
      const matchingPlaylists = playlists.filter((playlist: any) =>
        playlist.name.toLowerCase().includes(searchTerm)
      );

      if (matchingPlaylists.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No playlists found matching "${name}".`,
              [Symbol.for("any")]: true,
            },
          ],
        };
      }

      // Use the first matching playlist
      const playlist = matchingPlaylists[0];

      // Play the playlist
      const playResult = await playPlaylist(playlist.id, shuffle);

      return {
        content: [
          {
            type: "text",
            text: `Found and playing playlist: "${playlist.name}" ${
              shuffle ? "on shuffle mode" : "in order"
            }`,
            [Symbol.for("any")]: true,
          },
        ],
      };
    } catch (error) {
      console.error("Error in find-playlist:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error trying to find and play playlist: ${error}`,
            [Symbol.for("any")]: true,
          },
        ],
      };
    }
  }
);

// Define debug tool to check configuration
server.tool(
  "spotify-debug",
  "Debug Spotify configuration and connection",
  {},
  async (_args, extra) => {
    console.error("Running Spotify configuration debug...");
    const result = await debugSpotifyConfig();
    return {
      content: result,
    };
  }
);

async function main() {
  // Initialize transport
  const transport = new StdioServerTransport();
  console.error("Spotify MCP Server starting...");

  try {
    // Connect to the transport
    await server.connect(transport);
    console.error("Spotify MCP Server connected");

    // Log startup message (to stderr since we can't use loggingNotification)
    console.error("Spotify MCP Server started successfully");
  } catch (error) {
    console.error("Failed to initialize Spotify MCP Server:", error);
    process.exit(1);
  }
}

main();
