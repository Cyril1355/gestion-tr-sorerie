let db;
const moisLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// 1. Initialisation de la base de données
const request = indexedDB.open("FreelanceExpertDB", 1);
request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("finance")) db.createObjectStore("finance", { keyPath: "id" });
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
};
request.onsuccess = e => { db = e.target.result; renderApp(); };

// 2. Affichage principal
async function renderApp() {
    if (!db) return;
    const tx = db.transaction(["finance", "settings"], "readonly");
    const settingsStore = tx.objectStore("settings");
    const financeStore = tx.objectStore("finance");

    // Chargement Config & Logo
    const conf = await new Promise(r => settingsStore.get("config").onsuccess = e => r(e.target.result));
    const logo = await new Promise(r => settingsStore.get("logo").onsuccess = e => r(e.target.result));
    const isTvaForced = conf ? conf.tvaForced : false;

    if (conf) {
        document.getElementById('name-display').innerText = conf.name || "Ma Trésorerie";
        document.getElementById('siret-display').innerText = "SIRET : " + (conf.siret || "-");
        document.getElementById('inName').value = conf.name || "";
        document.getElementById('inSiret').value = conf.siret || "";
        if(document.getElementById('tvaForce')) document.getElementById('tvaForce').checked = isTvaForced;
    }

    if (logo && logo.src) {
        const img = document.getElementById('logo-img');
        img.src = logo.src;
        img.style.display = "block";
    }

    let html = "";
    let netArray = [];
    let cumulCA = 0;
    let tCA = 0, tTVA = 0, tURSSAF = 0, tFrais = 0, tNet = 0;

    for (let i = 0; i < 12; i++) {
        const row = await new Promise(r => financeStore.get(i).onsuccess = e => r(e.target.result)) || { ca: 0, frais: 0 };
        let tvaMois = isTvaForced ? row.ca * 0.20 : (cumulCA > 36800 ? row.ca * 0.20 : (cumulCA + row.ca > 36800 ? (cumulCA + row.ca - 36800) * 0.20 : 0));
        cumulCA += row.ca;
        let urssaf = (row.ca - tvaMois) * 0.211;
        let net = row.ca - tvaMois - urssaf - row.frais;
        
        tCA += row.ca; tTVA += tvaMois; tURSSAF += urssaf; tFrais += row.frais; tNet += net;
        netArray.push(net.toFixed(2));

        html += `<tr>
            <td>${moisLabels[i]}</td>
            <td><input type="number" value="${row.ca}" onchange="updateEntry(${i}, this.value, ${row.frais})"></td>
            <td>${tvaMois.toFixed(2)} €</td>
            <td>${urssaf.toFixed(2)} €</td>
            <td><input type="number" value="${row.frais}" onchange="updateEntry(${i}, ${row.ca}, this.value)"></td>
            <td style="font-weight:bold; color:#27ae60">${net.toFixed(2)} €</td>
        </tr>`;
    }

    document.getElementById('tbody').innerHTML = html;
    document.getElementById('tfoot').innerHTML = `<tr style="background:rgba(0,0,0,0.05); font-weight:bold;"><td>TOTAL ANNUEL</td><td>${tCA.toFixed(2)} €</td><td>${tTVA.toFixed(2)} €</td><td>${tURSSAF.toFixed(2)} €</td><td>${tFrais.toFixed(2)} €</td><td>${tNet.toFixed(2)} €</td></tr>`;
    drawChart(netArray);
}

// 3. Fonctions des boutons
function updateEntry(id, ca, frais) {
    const tx = db.transaction("finance", "readwrite");
    tx.objectStore("finance").put({ id, ca: parseFloat(ca) || 0, frais: parseFloat(frais) || 0 });
    tx.oncomplete = () => renderApp();
}

function saveConfig() {
    const name = document.getElementById('inName').value;
    const siret = document.getElementById('inSiret').value;
    const tvaForced = document.getElementById('tvaForce').checked;
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ id: "config", name, siret, tvaForced });
    tx.oncomplete = () => renderApp();
}

function saveLogo(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put({ id: "logo", src: e.target.result });
        tx.oncomplete = () => renderApp();
    };
    reader.readAsDataURL(input.files[0]);
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}

function exporterPDF() {
    console.log("Démarrage de l'export PDF haute précision...");
    const element = document.getElementById('app-body');
    
    // 1. On crée un style temporaire pour réorganiser la page pour le PDF
    const style = document.createElement('style');
    style.innerHTML = `
        /* On force le tableau et le graphique à se suivre verticalement */
        .main-layout { 
            display: flex !important; 
            flex-direction: column !important; 
        }
        .table-section, .chart-section { 
            width: 100% !important; 
            display: block !important; 
            position: relative !important; 
            margin-bottom: 30px !important;
        }
        /* On masque les éléments interactifs inutiles sur le papier */
        .toolbar, .main-actions, .btn, .config-inputs { 
            display: none !important; 
        }
        /* On s'assure que le graphique ne survole rien */
        canvas { 
            max-width: 100% !important; 
            height: auto !important; 
        }
    `;
    document.head.appendChild(style);

    // 2. Configuration de html2pdf
    const opt = {
        margin: [10, 10],
        filename: 'Expert_Tresorerie_Rapport.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            letterRendering: true 
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // 3. Exécution de l'export
    html2pdf().set(opt).from(element).save().then(() => {
        // 4. On supprime le style temporaire pour rendre l'interface normale
        style.remove();
        console.log("PDF généré proprement.");
    });
}

async function exportData() {
    const tx = db.transaction(["finance", "settings"], "readonly");
    const data = {
        finance: await new Promise(r => tx.objectStore("finance").getAll().onsuccess = e => r(e.target.result)),
        settings: await new Promise(r => tx.objectStore("settings").getAll().onsuccess = e => r(e.target.result))
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Backup_Expert.json`;
    a.click();
}

function importData(input) {
    const reader = new FileReader();
    reader.onload = async e => {
        const data = JSON.parse(e.target.result);
        const tx = db.transaction(["finance", "settings"], "readwrite");
        if(data.finance) data.finance.forEach(row => tx.objectStore("finance").put(row));
        if(data.settings) data.settings.forEach(row => tx.objectStore("settings").put(row));
        tx.oncomplete = () => { renderApp(); alert("Données importées !"); };
    };
    reader.readAsText(input.files[0]);
}

function drawChart(data) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (window.chart) window.chart.destroy();
    window.chart = new Chart(ctx, {
        type: 'line',
        data: { labels: moisLabels.map(m => m.substring(0,3)), datasets: [{ label: 'Bénéfice Net (€)', data: data, borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
