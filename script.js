let db;
const moisLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const request = indexedDB.open("FreelanceExpertDB", 1);
request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("finance")) db.createObjectStore("finance", { keyPath: "id" });
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
};
request.onsuccess = e => { db = e.target.result; renderApp(); };

async function renderApp() {
    if (!db) return;
    const tx = db.transaction(["finance", "settings"], "readonly");
    const settingsStore = tx.objectStore("settings");
    const financeStore = tx.objectStore("finance");

    const conf = await new Promise(r => settingsStore.get("config").onsuccess = e => r(e.target.result));
    const isTvaForced = conf ? conf.tvaForced : false;

    if (conf) {
        document.getElementById('name-display').innerText = conf.name || "Ma Trésorerie";
        document.getElementById('siret-display').innerText = "SIRET : " + (conf.siret || "-");
        document.getElementById('inName').value = conf.name || "";
        document.getElementById('inSiret').value = conf.siret || "";
        if(document.getElementById('tvaForce')) document.getElementById('tvaForce').checked = isTvaForced;
    }

    const logo = await new Promise(r => settingsStore.get("logo").onsuccess = e => r(e.target.result));
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

        let tvaMois = 0;
        if (isTvaForced) {
            tvaMois = row.ca * 0.20;
        } else {
            if (cumulCA > 36800) {
                tvaMois = row.ca * 0.20;
            } else if (cumulCA + row.ca > 36800) {
                let depassement = (cumulCA + row.ca) - 36800;
                tvaMois = depassement * 0.20;
            }
        }

        cumulCA += row.ca;
        let urssaf = (row.ca - tvaMois) * 0.211;
        let net = row.ca - tvaMois - urssaf - row.frais;
        
        tCA += row.ca; tTVA += tvaMois; tURSSAF += urssaf; tFrais += row.frais; tNet += net;
        netArray.push(net.toFixed(2));

        html += `<tr>
            <td>${moisLabels[i]}</td>
            <td><input type="number" step="0.01" value="${row.ca}" onchange="updateEntry(${i}, this.value, ${row.frais})"></td>
            <td style="color: ${tvaMois > 0 ? '#e74c3c' : 'inherit'}">${tvaMois.toFixed(2)} €</td>
            <td>${urssaf.toFixed(2)} €</td>
            <td><input type="number" step="0.01" value="${row.frais}" onchange="updateEntry(${i}, ${row.ca}, this.value)"></td>
            <td style="font-weight:bold; color:#27ae60">${net.toFixed(2)} €</td>
        </tr>`;
    }

    document.getElementById('tbody').innerHTML = html;
    document.getElementById('tfoot').innerHTML = `
        <tr style="background: rgba(52, 73, 94, 0.1); font-weight: bold;">
            <td>TOTAL ANNUEL</td>
            <td>${tCA.toFixed(2)} €</td>
            <td style="color: #e74c3c">${tTVA.toFixed(2)} €</td>
            <td>${tURSSAF.toFixed(2)} €</td>
            <td>${tFrais.toFixed(2)} €</td>
            <td style="color: #27ae60; font-size: 1.1em;">${tNet.toFixed(2)} €</td>
        </tr>`;

    drawChart(netArray);
}

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

function drawChart(data) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (window.chart) window.chart.destroy();
    window.chart = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: moisLabels.map(m => m.substring(0, 3)), 
            datasets: [{ label: 'Bénéfice Net (€)', data: data, borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)', fill: true, tension: 0.3 }] 
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function toggleTheme() {
    const theme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', theme);
}

function exporterPDF() {
    document.getElementById('admin-tools').style.display = 'none';
    const element = document.getElementById('app-body');
    const opt = {
        margin: [10, 10],
        filename: `Rapport_${document.getElementById('name-display').innerText}.pdf`,
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save().then(() => {
        document.getElementById('admin-tools').style.display = 'flex';
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
    a.download = `Backup_Tresorerie.json`;
    a.click();
}

function importData(input) {
    const reader = new FileReader();
    reader.onload = async e => {
        const data = JSON.parse(e.target.result);
        const tx = db.transaction(["finance", "settings"], "readwrite");
        if(data.finance) data.finance.forEach(row => tx.objectStore("finance").put(row));
        if(data.settings) data.settings.forEach(row => tx.objectStore("settings").put(row));
        tx.oncomplete = () => { renderApp(); alert("Importation réussie !"); };
    };
    reader.readAsDataURL(input.files[0]);
}
