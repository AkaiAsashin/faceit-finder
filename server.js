require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

// Unser eigener API-Endpunkt
app.get('/api/player-details/:userInput', async (req, res) => {
    const userInput = req.params.userInput;
    const steamKey = process.env.STEAM_API_KEY;

    let steamId = null;
    let vanityName = null;

    // --- DER TÜRSTEHER: Eingabe analysieren ---

    // 1. Ist es direkt eine 17-stellige Zahl? (z.B. 76561198000000000)
    if (/^\d{17}$/.test(userInput)) {
        steamId = userInput;
    } 
    // 2. Ist es ein Link mit /profiles/ (da steht die 17-stellige ID schon drin)
    else if (userInput.includes('/profiles/')) {
        const match = userInput.match(/profiles\/(\d{17})/);
        if (match) steamId = match[1];
    } 
    // 3. Ist es ein Link mit /id/ (Custom URL, z.B. steamcommunity.com/id/KastenBrot)
    else if (userInput.includes('/id/')) {
        const match = userInput.match(/id\/([^/\s?]+)/);
        if (match) vanityName = match[1];
    } 
    // 4. Dann muss es ein reiner Text sein (Custom ID einfach so reingetippt)
    else {
        vanityName = userInput;
    }

    // --- DIE ÜBERSETZUNG: Steam nach der echten ID fragen ---
    if (vanityName && !steamId) {
        try {
            const resolveRes = await axios.get(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${steamKey}&vanityurl=${vanityName}`);
            // Steam antwortet mit success = 1, wenn der Name existiert
            if (resolveRes.data.response.success === 1) {
                steamId = resolveRes.data.response.steamid;
            }
        } catch (err) {
            console.error("Fehler beim Auflösen der Vanity URL", err.message);
        }
    }

    // Wenn wir nach all dem immer noch keine 17-stellige ID haben, brechen wir ab
    if (!steamId) {
        return res.status(400).json({ error: "Steam Profil nicht gefunden. Bitte überprüfe den Link oder Namen." });
    }

    let faceitData = null;
    let steamSummary = null;
    let steamGames = null;

    // 1. FACEIT DATEN HOLEN
    try {
        const faceitRes = await axios.get(`https://open.faceit.com/data/v4/players?game=csgo&game_player_id=${steamId}`, {
            headers: { 'Authorization': `Bearer ${process.env.FACEIT_API_KEY}` }
        });
        faceitData = faceitRes.data;
    } catch (err) {
        console.log("Kein Faceit-Profil für diese ID gefunden.");
    }

    // 2. STEAM PROFIL-INFOS HOLEN (Status & Alter)
    try {
        const steamSummaryRes = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamKey}&steamids=${steamId}`);
        steamSummary = steamSummaryRes.data.response.players[0];
    } catch (err) {
        console.error("Fehler beim Steam-Summary-Abruf", err.message);
    }

    // 3. STEAM SPIELZEIT HOLEN
    try {
        const steamGamesRes = await axios.get(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${steamKey}&steamid=${steamId}&format=json`);
        steamGames = steamGamesRes.data.response.games || [];
    } catch (err) {
        console.error("Fehler bei Steam-Spielzeit (Profil eventuell privat)", err.message);
    }

    // ... [Dein bisheriger Code für Faceit, Summary und Games] ...

    // 4. STEAM FREUNDE & BANS HOLEN
    let totalFriends = 0;
    let bannedFriends = 0;
    let bannedPercentage = 0;
    let friendsVisible = false;

    try {
        // Freundesliste abrufen
        const friendsRes = await axios.get(`https://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${steamKey}&steamid=${steamId}&relationship=friend`);
        const friendsList = friendsRes.data.friendslist.friends;
        totalFriends = friendsList.length;
        friendsVisible = true; // Liste ist öffentlich einsehbar

        if (totalFriends > 0) {
            // Alle Steam-IDs der Freunde in ein Array packen
            const friendIds = friendsList.map(f => f.steamid);
            const chunkSize = 100; // Steam erlaubt max 100 IDs pro Ban-Check
            const banPromises = [];

            // Array in 100er-Häppchen aufteilen
            for (let i = 0; i < friendIds.length; i += chunkSize) {
                const chunk = friendIds.slice(i, i + chunkSize).join(',');
                // Request vorbereiten, aber noch nicht abschicken
                banPromises.push(
                    axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${steamKey}&steamids=${chunk}`)
                );
            }

            // Alle Häppchen gleichzeitig an Steam schicken
            const banResults = await Promise.all(banPromises);

            // Ergebnisse durchgehen und Bans zählen
            banResults.forEach(res => {
                const players = res.data.players;
                players.forEach(player => {
                    // Wir zählen VAC-Bans und Game-Bans
                    if (player.VACBanned || player.NumberOfGameBans > 0) {
                        bannedFriends++;
                    }
                });
            });

            // Prozentwert berechnen und kaufmännisch runden
            bannedPercentage = Math.round((bannedFriends / totalFriends) * 100);
        }
    } catch (err) {
        // Wenn das Profil privat ist, wirft Steam hier einen Fehler. Das ignorieren wir einfach.
        console.log("Freundesliste privat oder nicht abrufbar.");
    }

    // 4. DATEN FÜR DAS FRONTEND ZUSAMMENBAUEN
    if (!steamSummary) {
        return res.status(404).json({ error: "Steam-Spieler nicht gefunden" });
    }

    // CS2 Spielzeit filtern (AppID 730)
    const cs2Game = steamGames.find(g => g.appid === 730);
    const totalHours = cs2Game ? Math.round(cs2Game.playtime_forever / 60) : 0;
    const recentHours = cs2Game && cs2Game.playtime_2weeks ? Math.round(cs2Game.playtime_2weeks / 60) : 0;

    // Erstellungsdatum lesbar machen
    const createdDate = steamSummary.timecreated 
        ? new Date(steamSummary.timecreated * 1000).toLocaleDateString('de-DE') 
        : "Unbekannt";

    const responsePayload = {
        // Steam Infos
        nickname: steamSummary.personaname,
        avatar: steamSummary.avatarfull,
        isPublic: steamSummary.communityvisibilitystate === 3 ? "Public" : "Private",
        accountCreated: createdDate,
        cs2TotalHours: totalHours,
        cs2RecentHours: recentHours,
        friendsVisible: friendsVisible,
        totalFriends: totalFriends,
        bannedFriends: bannedFriends,
        bannedPercentage: bannedPercentage,
        
        // Faceit Infos (falls vorhanden)
        hasFaceit: !!faceitData,
        faceit: faceitData ? {
            nickname: faceitData.nickname,
            elo: faceitData.games.cs2?.faceit_elo || faceitData.games.csgo?.faceit_elo || "N/A",
            level: faceitData.games.cs2?.skill_level || faceitData.games.csgo?.skill_level || "N/A",
            // Hinweis: Für K/D und Matches müssen wir später noch den Faceit-Stats-Endpunkt fragen
        } : null
    };

    res.json(responsePayload);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Backend läuft auf Port ${PORT}`);
});