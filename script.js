// Listener für Button und Enter-Taste
document.getElementById('searchButton').addEventListener('click', parseAndFetch);
document.getElementById('steamIdInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        parseAndFetch();
    }
});

// Nimmt den Input, trennt ihn am Semikolon und lädt die Spieler
async function parseAndFetch() {
    const inputField = document.getElementById('steamIdInput');
    const rawInput = inputField.value;
    if (!rawInput.trim()) return alert("Bitte eine ID oder einen Link eingeben!");

    // Am Semikolon splitten und leere Einträge herausfiltern
    const inputs = rawInput.split(';').map(i => i.trim()).filter(i => i !== "");
    
    // Eingabefeld leeren für den nächsten Suchvorgang
    inputField.value = "";

    // Jeden Spieler nacheinander abfragen
    for (const input of inputs) {
        await ladeSpieler(input);
    }
}

async function ladeSpieler(id) {
    try {
        const response = await fetch(`http://localhost:3000/api/player-details/${encodeURIComponent(id)}`);
        const data = await response.json();

        if (data.error) {
            console.error(`Fehler bei ${id}: ${data.error}`);
            return; // Wir werfen keinen Alert mehr, um den Flow bei mehreren Suchen nicht zu stören
        }

        baueKachel(data);
    } catch (err) {
        console.error("Netzwerkfehler:", err);
    }
}

function baueKachel(data) {
    const container = document.getElementById('kachelContainer');

    // LIMIT CHECK: Bulletproof mit while-Schleife. 
    // Wir machen so lange Platz, bis maximal noch 9 Kacheln da sind, 
    // damit die neue Kachel exakt Nummer 10 wird.
    while (container.children.length >= 10) {
        container.removeChild(container.firstChild);
    }

    // --- FARBEN & LOGIK BERECHNEN ---
    
    const isPublicColor = (data.isPublic === "Public") ? "#00e676" : "#ff4d4d";
    
    // ... hier geht dein restlicher Code ganz normal weiter ...
    
    let accountAgeColor = "#ff4d4d";
    if (data.accountCreated !== "Unbekannt") {
        const parts = data.accountCreated.split('.');
        const creationDate = new Date(parts[2], parts[1] - 1, parts[0]);
        const einJahrZurueck = new Date();
        einJahrZurueck.setFullYear(einJahrZurueck.getFullYear() - 1);
        accountAgeColor = (creationDate > einJahrZurueck) ? "#ff4d4d" : "#00e676";
    }

    const totalHoursColor = (data.cs2TotalHours < 500) ? "#ff4d4d" : "#00e676";
    const recentHoursColor = (data.cs2RecentHours < 1) ? "#ff4d4d" : "#00e676";

    let friendsText = "0 Freunde";
    let friendsColor = "#00e676";
    if (data.friendsVisible && data.totalFriends > 0) {
        friendsText = `${data.bannedFriends} / ${data.totalFriends} (${data.bannedPercentage}%)`;
        friendsColor = (data.bannedFriends > 0) ? "#ff4d4d" : "#00e676";
    } else if (!data.friendsVisible) {
        friendsText = "Privat";
        friendsColor = "#ff4d4d";
    }

    // Faceit Logik
    let faceitLevel = "-";
    let faceitElo = "Kein Faceit";
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

    // --- KACHEL ERSCHAFFEN ---
    const kachel = document.createElement('div');
    kachel.className = 'kachel';
    kachel.innerHTML = `
        <div class="header-bereich">
            <img class="avatar" src="${data.avatar || 'https://via.placeholder.com/80'}" alt="Avatar">
            <h2>${data.nickname}</h2>
        </div>

        <div class="sektion">
            <div class="sektion-titel">Steam Account Infos</div>
            <div class="stat-row"><span>Profil-Status:</span> <span class="stat-value" style="color: ${isPublicColor}">${data.isPublic}</span></div>
            <div class="stat-row"><span>Erstellt am:</span> <span class="stat-value" style="color: ${accountAgeColor}">${data.accountCreated}</span></div>
            <div class="stat-row"><span>CS2 Gesamtzeit:</span> <span class="stat-value" style="color: ${totalHoursColor}">${data.cs2TotalHours} Std.</span></div>
            <div class="stat-row"><span>Letzte 2 Wochen:</span> <span class="stat-value" style="color: ${recentHoursColor}">${data.cs2RecentHours} Std.</span></div>
            <div class="stat-row"><span>Gebannte Freunde:</span> <span class="stat-value" style="color: ${friendsColor}">${friendsText}</span></div>
        </div>

        <div class="faceit-sektion">
            <div class="faceit-bg" style="${bannerStyle}"></div>
            <div class="faceit-content">
                <div class="sektion-titel" style="text-align: center; border-bottom: none;">Faceit Infos</div>
                <div class="faceit-center-box">
                    <div class="faceit-icon" style="background-color: ${faceitBgColor}; color: ${faceitTextColor};">${faceitLevel}</div>
                    <div class="faceit-elo"><span>${faceitElo}</span> ELO</div>
                </div>
            </div>
        </div>
    `;

    // Kachel an das Ende des Containers anfügen
    container.appendChild(kachel);
}