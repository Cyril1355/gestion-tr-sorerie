let db;
const moisLabels = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const request = indexedDB.open("FreelanceExpertDB", 1);
request.onupgradeneeded = e => {
    db = e.target.result;
    db.createObjectStore("finance", { keyPath: "id" });
    db.createObjectStore("settings", { keyPath: "id" });
};
request.onsuccess = e => { db = e.target.result; renderApp(); };

async function renderApp() {
    const tx = db.transaction(["finance", "settings"], "readonly");
    const settings = tx.objectStore("settings");
    const finance = tx.objectStore("finance");

    const conf = await new Promise(r => settings.get("config").onsuccess = e => r(e.target.result));
    const isTvaForced = conf ? conf.tvaForced : false;

    if(conf) {
        document.getElementById('name-display').innerText = conf.name || "Ma Trésorerie";
        document.getElementById('siret-display').innerText = "SIRET : " + (conf.siret || "-");
        document.getElementById('inName').value = conf.name || "";
        document.getElementById('inSiret').value = conf.siret || "";
        document.getElementById('tvaForce').checked = isTvaForced;
    }

    const logo = await new Promise(r => settings.get("logo").onsuccess = e => r(e.target.result));
    if(logo && logo.src) {
        document.getElementById('logo-img').src = logo.src;
        document.getElementById('logo-img').style.display = "block";
    }

    let html = "";
    let cumulCA = 0;
    let netArray = [];

    for(let i=0; i<12; i++) {
        const row = await new Promise(r => finance.get(i).onsuccess = e => r(e.target.result)) || {ca:0, frais:0};
        
        let tvaMois = 0;
        if (isTvaForced) {
            tvaMois = row.ca * 0.20;
        } else {
            if (cumulCA > 36800) {
                tvaMois = row.ca * 0.20;
            } else if (cumulCA + row.ca > 36800) {
                let dépassement = (cumulCA + row.ca) - 36800;
                tvaMois = dépassement * 0.20;
            }
        }

        cumulCA += row.ca;
        let urssaf = (row.ca - tvaMois) * 0.211;
        let net = row.ca - tvaMois - urssaf - row.frais;
        netArray.push(net.toFixed(2));

        html += `<tr>
            <td>${moisLabels[i]}</td>
            <td><input type="number" value="${row.ca}" onchange="updateEntry(${i}, this.value, ${row.frais})"></td>
            <td style="color: ${tvaMois > 0 ? '#e74c3c' : 'inherit'}">${tvaMois.toFixed(2)} €</td>
            <td>${urssaf.toFixed(2)} €</td>
            <td><input type="number" value="${row.frais}" onchange="updateEntry(${i}, ${row.ca}, this.value)"></td>
            <td style="font-weight:bold; color:#27ae60">${net.toFixed(2)} €</td>
        </tr>`;
    }
    document.getElementById('tbody').innerHTML = html;
    drawChart(netArray);
}

function updateEntry(id, ca, frais) {
    const tx = db.transaction("finance", "readwrite");
    tx.objectStore("finance").put({ id, ca: parseFloat(ca)||0, frais: parseFloat(frais)||0 });
    renderApp();
}

function saveConfig() {
    const name = document.getElementById('inName').value;
    const siret = document.getElementById('inSiret').value;
    const tvaForced = document.getElementById('tvaForce').checked;
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ id: "config", name, siret, tvaForced });
    renderApp();
}

function saveLogo(input) {
    if(!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
        const tx = db.transaction("settings", "readwrite");
        tx.objectStore("settings").put({ id: "logo", src: e.target.result });
        renderApp();
    };
    reader.readAsDataURL(input.files[0]);
}

function toggleTheme() {
    const theme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', theme);
}

function drawChart(data) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if(window.chart) window.chart.destroy();
    window.chart = new Chart(ctx, {
        type: 'line',
        data: { labels: moisLabels.map(m => m.substring(0,3)), datasets: [{ label: 'Bénéfice Net (€)', data: data, borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function exporterPDF() {
    document.getElementById('admin-tools').style.display = 'none';
    const element = document.getElementById('app-body');
    const opt = {
        margin: [10, 10],
        filename: `Rapport_${document.getElementById('name-display').innerText}_2026.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
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
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
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
        data.finance.forEach(row => tx.objectStore("finance").put(row));
        data.settings.forEach(row => tx.objectStore("settings").put(row));
        tx.oncomplete = () => { renderApp(); alert("Données importées avec succès !"); };
    };
    reader.readAsDataURL(input.files[0]);
}

window.onbeforeunload = () => "Pensez à faire un Backup avant de quitter si vous changez de PC !";
