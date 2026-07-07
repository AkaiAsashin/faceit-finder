// Listener for Button and Enter key
document.getElementById('searchButton').addEventListener('click', parseAndFetch);
document.getElementById('steamIdInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        parseAndFetch();
    }
});

// Takes input, splits by semicolon, and fetches players
async function parseAndFetch() {
    const inputField = document.getElementById('steamIdInput');
    const rawInput = inputField.value;
    if (!rawInput.trim()) return alert("Please enter an ID or a link!");

    // Split at semicolon and filter empty entries
    const inputs = rawInput.split(';').map(i => i.trim()).filter(i => i !== "");
    
    // Clear input field for next search
    inputField.value = "";

    // Fetch each player sequentially
    for (const input of inputs) {
        await ladeSpieler(input);
    }
}

async function ladeSpieler(id) {
    try {
        const response = await fetch(`/api/player-details/${encodeURIComponent(id)}`);
        const data = await response.json();

        if (data.error) {
            console.error(`Error with ${id}: ${data.error}`);
            return;
        }

        baueKachel(data);
    } catch (err) {
        console.error("Network error:", err);
    }
}

function baueKachel(data) {
    const container = document.getElementById('kachelContainer');

    // LIMIT CHECK: Make room until max 9 tiles are left, so the new one is exactly #10
    while (container.children.length >= 10) {
        container.removeChild(container.firstChild);
    }

    // --- LOGIC & COLORS ---
    const isPublic = data.isPublic === "Public";
    const isPublicColor = isPublic ? "#00e676" : "#ff4d4d";
    
    // Variables for display texts and colors
    let accountAgeText = data.accountCreated;
    let accountAgeColor = "#ff4d4d";
    let totalHoursText = (data.cs2TotalHours === "Private") ? "Private" : data.cs2TotalHours + " hrs";
    let totalHoursColor = (data.cs2TotalHours === "Private" || data.cs2TotalHours < 500) ? "#ff4d4d" : "#00e676";
    let recentHoursText = (data.cs2RecentHours === "Private") ? "Private" : data.cs2RecentHours + " hrs";
    let recentHoursColor = (data.cs2RecentHours === "Private" || data.cs2RecentHours < 2) ? "#ff4d4d" : "#00e676";

    // If account is private, overwrite everything with "Private" in red
    if (!isPublic) {
        accountAgeText = "Private";
        accountAgeColor = "#ff4d4d";
        totalHoursText = "Private";
        totalHoursColor = "#ff4d4d";
        recentHoursText = "Private";
        recentHoursColor = "#ff4d4d";
    } else {
        // Calculate age color only if public and known
        if (data.accountCreated !== "Unbekannt" && data.accountCreated !== "Unknown") {
            const parts = data.accountCreated.split('.');
            const creationDate = new Date(parts[2], parts[1] - 1, parts[0]);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            accountAgeColor = (creationDate > oneYearAgo) ? "#ff4d4d" : "#00e676";
        } else {
            accountAgeText = "Unknown";
        }
    }

    // Banned friends logic
    let friendsText = "0 friends";
    let friendsColor = "#00e676";
    if (data.friendsVisible && data.totalFriends > 0) {
        friendsText = `${data.bannedFriends} / ${data.totalFriends} (${data.bannedPercentage}%)`;
        friendsColor = (data.bannedFriends > 0) ? "#ff4d4d" : "#00e676";
    } else if (!data.friendsVisible) {
        friendsText = "Private";
        friendsColor = "#ff4d4d";
    }

    // Faceit logic
    let faceitLevel = "-";
    let faceitElo = "No Faceit";
    let faceitBgColor = "#444";
    let faceitTextColor = "#fff";
    let bannerStyle = "display: none;";

    if (data.hasFaceit) {
        const level = parseInt(data.faceit.level);
        faceitLevel = level || "-";
        faceitElo = data.faceit.elo;

        if (level === 1) { faceitBgColor = '#EEEEEE'; faceitTextColor = '#333'; }
        else if (level >= 2 && level <= 3) { faceitBgColor = '#1CE500'; faceitTextColor = '#fff'; }
        else if (level >= 4 && level <= 7) { faceitBgColor = '#FFC600'; faceitTextColor = '#333'; }
        else if (level >= 8 && level <= 9) { faceitBgColor = '#FF6900'; faceitTextColor = '#fff'; }
        else if (level === 10) { faceitBgColor = '#FE0000'; faceitTextColor = '#fff'; }

        if (data.faceit.coverImage) {
            bannerStyle = `display: block; background-image: url('${data.faceit.coverImage}');`;
        }
    }

    // --- CREATE TILE ---
    const kachel = document.createElement('div');
    kachel.className = 'kachel';
    kachel.innerHTML = `
        <div class="header-bereich">
            <img class="avatar" src="${data.avatar || 'https://via.placeholder.com/80'}" alt="Avatar">
            <h2>${data.nickname}</h2>
        </div>

        <div class="sektion">
            <div class="sektion-titel">Steam Account Info</div>
            <div class="stat-row"><span>Profile Status:</span> <span class="stat-value" style="color: ${isPublicColor}">${data.isPublic}</span></div>
            <div class="stat-row"><span>Created on:</span> <span class="stat-value" style="color: ${accountAgeColor}">${accountAgeText}</span></div>
            <div class="stat-row"><span>CS2 Total Time:</span> <span class="stat-value" style="color: ${totalHoursColor}">${totalHoursText}</span></div>
            <div class="stat-row"><span>Last 2 Weeks:</span> <span class="stat-value" style="color: ${recentHoursColor}">${recentHoursText}</span></div>
            <div class="stat-row"><span>Banned Friends:</span> <span class="stat-value" style="color: ${friendsColor}">${friendsText}</span></div>
        </div>

        <div class="faceit-sektion">
            <div class="faceit-bg" style="${bannerStyle}"></div>
            <div class="faceit-content">
                <div class="sektion-titel" style="text-align: center; border-bottom: none;">Faceit Info</div>
                <div class="faceit-center-box">
                    <div class="faceit-icon" style="background-color: ${faceitBgColor}; color: ${faceitTextColor};">${faceitLevel}</div>
                    <div class="faceit-elo"><span>${faceitElo}</span> ELO</div>
                </div>
            </div>
        </div>
    `;

    // Append tile to the container
    container.appendChild(kachel);
}