import SpotifyWebApi from "spotify-web-api-node";
import { config } from "dotenv";

// Define content types to match MCP SDK expectations
interface TextContent {
  type: "text";
  text: string;
  [key: string]: unknown;
}

// Load environment variables
config();

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
});

// Track token refresh state
let tokenExpirationTime = 0;

/**
 * Ensures the Spotify access token is valid
 */
export async function ensureAccessToken(): Promise<void> {
  const now = Date.now();

  // If token is expired or will expire in the next minute, refresh it
  if (now >= tokenExpirationTime - 60000) {
    try {
      console.error("Refreshing Spotify access token...");

      // Use refresh token flow for proper authentication with all permissions
      if (process.env.SPOTIFY_REFRESH_TOKEN) {
        try {
          console.error("Using refresh token authentication...");
          const refreshData = await spotifyApi.refreshAccessToken();
          spotifyApi.setAccessToken(refreshData.body.access_token);
          tokenExpirationTime =
            now + refreshData.body.expires_in * 1000 - 60000;
          console.error(
            "Successfully refreshed token using refresh token flow"
          );
        } catch (refreshError) {
          console.error(
            "Error refreshing token with refresh token:",
            refreshError
          );
          throw new Error("Failed to refresh access token with refresh token");
        }
      } else {
        console.error(
          "No refresh token available - playback control requires a refresh token"
        );

        // Fall back to client credentials as a last resort (limited functionality)
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body.access_token);
        tokenExpirationTime = now + data.body.expires_in * 1000 - 60000;
        console.error(
          "Using client credentials flow with limited functionality"
        );
      }

      console.error("Spotify access token refreshed successfully");
    } catch (error) {
      console.error("Error refreshing Spotify access token:", error);
      throw new Error("Failed to authenticate with Spotify");
    }
  }
}

/**
 * Debug function to check Spotify configuration
 */
export async function debugSpotifyConfig(): Promise<TextContent[]> {
  // Check environment variables
  const clientId = process.env.SPOTIFY_CLIENT_ID ? "✅ Set" : "❌ Missing";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
    ? "✅ Set"
    : "❌ Missing";
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI
    ? "✅ Set"
    : "❌ Missing";
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN
    ? "✅ Set"
    : "❌ Missing";

  let tokenStatus = "❓ Not tested";
  let premiumStatus = "❓ Unknown";
  let activeDevice = "❓ Not checked";

  try {
    // Try to refresh the token
    await ensureAccessToken();
    tokenStatus = "✅ Successfully obtained access token";

    // Check if token has user scopes by trying to get user info
    try {
      const me = await spotifyApi.getMe();
      const product = me.body.product;
      premiumStatus =
        product === "premium"
          ? "✅ Premium account"
          : `❌ Non-premium account (${product})`;
    } catch (userError) {
      console.error("Could not get user info:", userError);
      premiumStatus = "❌ Failed to verify premium status";
    }

    // Check for active devices
    try {
      const devices = await spotifyApi.getMyDevices();
      if (devices.body.devices && devices.body.devices.length > 0) {
        const activeDevices = devices.body.devices
          .filter((d) => d.is_active)
          .map((d) => d.name);
        if (activeDevices.length > 0) {
          activeDevice = `✅ Active devices: ${activeDevices.join(", ")}`;
        } else {
          activeDevice =
            "❌ No active devices found. Open Spotify on a device first.";
        }
      } else {
        activeDevice =
          "❌ No devices found. Open Spotify on at least one device.";
      }
    } catch (deviceError) {
      console.error("Could not get devices:", deviceError);
      activeDevice = "❌ Failed to check devices - likely missing permissions";
    }
  } catch (error) {
    tokenStatus = `❌ Failed to get access token: ${error}`;
  }

  return [
    {
      type: "text",
      text: `
=== Spotify MCP Configuration Debug ===

Environment Variables:
- SPOTIFY_CLIENT_ID: ${clientId}
- SPOTIFY_CLIENT_SECRET: ${clientSecret}
- SPOTIFY_REDIRECT_URI: ${redirectUri}
- SPOTIFY_REFRESH_TOKEN: ${refreshToken}

Authentication:
- Token Status: ${tokenStatus}
- Premium Status: ${premiumStatus}
- Active Device: ${activeDevice}

If any of these show errors, please check the following:
1. For missing environment variables: Add them to your .env file and claude_desktop_config.json
2. For token failures: Your refresh token may be expired. Generate a new one.
3. For non-premium account: Playback control requires Spotify Premium
4. For no active devices: Open Spotify on a device and play something first
`,
    },
  ];
}

/**
 * Search for tracks by query string
 */
export async function searchTracks(
  query: string,
  limit: number = 5
): Promise<TextContent[]> {
  await ensureAccessToken();

  try {
    const response = await spotifyApi.searchTracks(query, { limit });

    if (response.body.tracks && response.body.tracks.items.length > 0) {
      return response.body.tracks.items.map((track) => ({
        type: "text" as const,
        text: JSON.stringify(
          {
            id: track.id,
            name: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            album: track.album.name,
            uri: track.uri,
            duration_ms: track.duration_ms,
            popularity: track.popularity,
            preview_url: track.preview_url,
          },
          null,
          2
        ),
      }));
    }

    return [{ type: "text", text: "No tracks found matching your query." }];
  } catch (error) {
    console.error("Error searching for tracks:", error);
    return [{ type: "text", text: `Error searching for tracks: ${error}` }];
  }
}

/**
 * Play a track by URI or ID
 */
export async function playTrack(trackId: string): Promise<TextContent[]> {
  await ensureAccessToken();

  try {
    // Check if it's a full URI or just an ID
    const uri = trackId.startsWith("spotify:track:")
      ? trackId
      : `spotify:track:${trackId}`;

    await spotifyApi.play({ uris: [uri] });

    return [{ type: "text", text: `Now playing track with URI: ${uri}` }];
  } catch (error) {
    console.error("Error playing track:", error);

    // Check if it's a missing scopes error
    const errorMessage = String(error);

    if (errorMessage.includes("NOT_PREMIUM")) {
      return [
        {
          type: "text",
          text: "Error: This functionality requires a Spotify Premium account.",
        },
      ];
    }

    if (errorMessage.includes("PERMISSION")) {
      return [
        {
          type: "text",
          text: "Error: Missing required permissions. Make sure your refresh token has the user-modify-playback-state scope.",
        },
      ];
    }

    if (errorMessage.includes("NO_ACTIVE_DEVICE")) {
      return [
        {
          type: "text",
          text: "Error: No active Spotify playback device found. Please open Spotify on a device first.",
        },
      ];
    }

    return [{ type: "text", text: `Error playing track: ${error}` }];
  }
}

/**
 * Get user's currently playing track
 */
export async function getCurrentlyPlaying(): Promise<TextContent[]> {
  await ensureAccessToken();

  try {
    const response = await spotifyApi.getMyCurrentPlayingTrack();

    if (response.body && response.body.item) {
      const track = response.body.item;

      // Check if it's a track (not an episode)
      if ("artists" in track && "album" in track) {
        return [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: track.id,
                name: track.name,
                artist: track.artists.map((a: any) => a.name).join(", "),
                album: track.album.name,
                uri: track.uri,
                progress_ms: response.body.progress_ms,
                duration_ms: track.duration_ms,
                is_playing: response.body.is_playing,
              },
              null,
              2
            ),
          },
        ];
      } else {
        // Handle podcast episodes
        return [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: track.id,
                name: track.name,
                type: "episode",
                uri: track.uri,
                progress_ms: response.body.progress_ms,
                duration_ms: track.duration_ms,
                is_playing: response.body.is_playing,
              },
              null,
              2
            ),
          },
        ];
      }
    }

    return [{ type: "text", text: "No track currently playing." }];
  } catch (error) {
    console.error("Error getting currently playing track:", error);
    return [
      { type: "text", text: `Error getting currently playing track: ${error}` },
    ];
  }
}

/**
 * Get available devices
 */
export async function getDevices(): Promise<TextContent[]> {
  await ensureAccessToken();

  try {
    const response = await spotifyApi.getMyDevices();

    if (
      response.body &&
      response.body.devices &&
      response.body.devices.length > 0
    ) {
      return [
        {
          type: "text",
          text: JSON.stringify(
            response.body.devices.map((device) => ({
              id: device.id,
              name: device.name,
              type: device.type,
              is_active: device.is_active,
              volume_percent: device.volume_percent,
            })),
            null,
            2
          ),
        },
      ];
    }

    return [{ type: "text", text: "No available Spotify devices found." }];
  } catch (error) {
    console.error("Error getting devices:", error);
    return [{ type: "text", text: `Error getting devices: ${error}` }];
  }
}

/**
 * Get user's playlists
 */
export async function getUserPlaylists(
  limit: number = 20
): Promise<TextContent[]> {
  await ensureAccessToken();

  try {
    const response = await spotifyApi.getUserPlaylists({ limit });

    if (response.body && response.body.items.length > 0) {
      return [
        {
          type: "text",
          text: JSON.stringify(
            response.body.items.map((playlist) => ({
              id: playlist.id,
              name: playlist.name,
              description: playlist.description,
              tracks_total: playlist.tracks.total,
              uri: playlist.uri,
              public: playlist.public,
              owner: playlist.owner.display_name || playlist.owner.id,
              image: playlist.images.length > 0 ? playlist.images[0].url : null,
            })),
            null,
            2
          ),
          [Symbol.for("any")]: true,
        },
      ];
    }

    return [
      {
        type: "text",
        text: "No playlists found.",
        [Symbol.for("any")]: true,
      },
    ];
  } catch (error) {
    console.error("Error getting user playlists:", error);
    return [
      {
        type: "text",
        text: `Error getting user playlists: ${error}`,
        [Symbol.for("any")]: true,
      },
    ];
  }
}

/**
 * Get tracks in a playlist
 */
export async function getPlaylistTracks(
  playlistId: string,
  limit: number = 50
): Promise<TextContent[]> {
  await ensureAccessToken();

  try {
    // First get playlist details
    const playlistResponse = await spotifyApi.getPlaylist(playlistId);
    const playlistName = playlistResponse.body.name;

    // Then get tracks
    const response = await spotifyApi.getPlaylistTracks(playlistId, { limit });

    if (response.body && response.body.items.length > 0) {
      return [
        {
          type: "text",
          text: JSON.stringify(
            {
              playlist_name: playlistName,
              total_tracks: response.body.total,
              tracks: response.body.items.map((item, index) => {
                const track = item.track;
                if (!track) {
                  return {
                    position: index + 1,
                    name: "Unknown track",
                    added_at: item.added_at,
                  };
                }
                return {
                  position: index + 1,
                  id: track.id,
                  name: track.name,
                  artist:
                    "artists" in track
                      ? track.artists.map((a: any) => a.name).join(", ")
                      : "Unknown",
                  album: "album" in track ? track.album.name : "Unknown",
                  duration_ms: track.duration_ms,
                  added_at: item.added_at,
                  uri: track.uri,
                };
              }),
            },
            null,
            2
          ),
          [Symbol.for("any")]: true,
        },
      ];
    }

    return [
      {
        type: "text",
        text: `Playlist "${playlistName}" is empty.`,
        [Symbol.for("any")]: true,
      },
    ];
  } catch (error) {
    console.error("Error getting playlist tracks:", error);
    return [
      {
        type: "text",
        text: `Error getting playlist tracks: ${error}`,
        [Symbol.for("any")]: true,
      },
    ];
  }
}

/**
 * Play a playlist
 */
export async function playPlaylist(
  playlistId: string,
  shuffle: boolean = false
): Promise<TextContent[]> {
  await ensureAccessToken();

  try {
    // First get the playlist details to display its name
    const playlistResponse = await spotifyApi.getPlaylist(playlistId);
    const playlistName = playlistResponse.body.name;

    // Set shuffle state if specified
    if (shuffle !== undefined) {
      await spotifyApi.setShuffle(shuffle);
    }

    // Use the correct URI format for playlists
    const uri = playlistId.startsWith("spotify:playlist:")
      ? playlistId
      : `spotify:playlist:${playlistId}`;

    // Play the playlist - note that we use context_uri for playlists instead of uris array
    await spotifyApi.play({ context_uri: uri });

    return [
      {
        type: "text",
        text: `Now playing playlist "${playlistName}" ${
          shuffle ? "on shuffle mode" : "in order"
        }.`,
        [Symbol.for("any")]: true,
      },
    ];
  } catch (error) {
    console.error("Error playing playlist:", error);

    // Check if it's a known error
    const errorMessage = String(error);

    if (errorMessage.includes("NOT_PREMIUM")) {
      return [
        {
          type: "text",
          text: "Error: This functionality requires a Spotify Premium account.",
          [Symbol.for("any")]: true,
        },
      ];
    }

    if (errorMessage.includes("PERMISSION")) {
      return [
        {
          type: "text",
          text: "Error: Missing required permissions. Make sure your refresh token has the user-modify-playback-state scope.",
          [Symbol.for("any")]: true,
        },
      ];
    }

    if (errorMessage.includes("NO_ACTIVE_DEVICE")) {
      return [
        {
          type: "text",
          text: "Error: No active Spotify playback device found. Please open Spotify on a device first.",
          [Symbol.for("any")]: true,
        },
      ];
    }

    return [
      {
        type: "text",
        text: `Error playing playlist: ${error}`,
        [Symbol.for("any")]: true,
      },
    ];
  }
}

export default spotifyApi;
