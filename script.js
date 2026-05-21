const moisAnnee = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
let chart;

document.addEventListener('DOMContentLoaded', () => {
    initialiserTableau();
    initialiserGraphique();
    if(localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
});

function initialiserTableau() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return; // Sécurité si l'élément n'est pas trouvé
    
    tbody.innerHTML = "";
    moisAnnee.forEach(mois => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${mois}</td>
            <td><input type="number" class="ca-brut" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td class="tva">0.00 €</td>
            <td class="urssaf">0.00 €</td>
            <td><input type="number" class="frais-input" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td class="net-reel">0.00 €</td>
        `;
        tbody.appendChild(row);
    });
    calculerTotaux();
}

function calculerLigne(row) {
    const caBrut = parseFloat(row.querySelector('.ca-brut').value) || 0;
    const tva = caBrut * 0.20;
    const urssaf = caBrut * 0.211;
    const frais = parseFloat(row.querySelector('.frais-input').value) || 0;

    row.querySelector('.tva').textContent = tva.toFixed(2) + " €";
    row.querySelector('.urssaf').textContent = urssaf.toFixed(2) + " €";
    
    const netReel = caBrut - tva - urssaf - frais;
    const netElt = row.querySelector('.net-reel');
    netElt.textContent = netReel.toFixed(2) + " €";
    
    netElt.style.color = netReel >= 0 ? "#27ae60" : "#e74c3c";

    calculerTotaux();
}

function calculerTotaux() {
    let totaux = { ca: 0, tva: 0, urssaf: 0, frais: 0, net: 0 };
    
    document.querySelectorAll('#table-body tr').forEach(row => {
        totaux.ca += parseFloat(row.querySelector('.ca-brut').value) || 0;
        totaux.tva += parseFloat(row.querySelector('.tva').textContent) || 0;
        totaux.urssaf += parseFloat(row.querySelector('.urssaf').textContent) || 0;
        totaux.frais += parseFloat(row.querySelector('.frais-input').value) || 0;
        totaux.net += parseFloat(row.querySelector('.net-reel').textContent) || 0;
    });

    if(document.getElementById('total-ca')) document.getElementById('total-ca').textContent = totaux.ca.toFixed(2) + " €";
    if(document.getElementById('total-tva')) document.getElementById('total-tva').textContent = totaux.tva.toFixed(2) + " €";
    if(document.getElementById('total-urssaf')) document.getElementById('total-urssaf').textContent = totaux.urssaf.toFixed(2) + " €";
    if(document.getElementById('total-frais')) document.getElementById('total-frais').textContent = totaux.frais.toFixed(2) + " €";
    if(document.getElementById('total-net')) document.getElementById('total-net').textContent = totaux.net.toFixed(2) + " €";

    mettreAJourGraphique();
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? '' : 'dark');
    localStorage.setItem('theme', isDark ? '' : 'dark');
}

function saveData() {
    const data = Array.from(document.querySelectorAll('#table-body tr')).map(row => ({
        ca: row.querySelector('.ca-brut').value,
        frais: row.querySelector('.frais-input').value
    }));
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup_tresorerie.json';
    a.click();
}

function importData(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const rows = document.querySelectorAll('#table-body tr');
            data.forEach((item, index) => {
                if(rows[index]) {
                    rows[index].querySelector('.ca-brut').value = item.ca || 0;
                    rows[index].querySelector('.frais-input').value = item.frais || 0;
                    calculerLigne(rows[index]);
                }
            });
        } catch (err) {
            alert("Erreur lors de l'importation.");
        }
    };
    reader.readAsText(event.target.files[0]);
}

function initialiserGraphique() {
    const canvas = document.getElementById('beneficeChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: moisAnnee,
            datasets: [{
                label: 'Bénéfice Net Mensuel (€)',
                data: new Array(12).fill(0),
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false
        }
    });
}

function mettreAJourGraphique() {
    const elts = document.querySelectorAll('.net-reel');
    if(elts.length === 0) return;
    
    const donnees = Array.from(elts).map(el => parseFloat(el.textContent) || 0);
    if(chart) {
        chart.data.datasets[0].data = donnees;
        chart.update();
    }
}

function exporterPDF() {
    const element = document.getElementById('app-body');
    const style = document.createElement('style');
    style.innerHTML = `
        .container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
        .main-layout { display: flex !important; flex-direction: column !important; }
        table { width: 100% !important; font-size: 10px !important; }
        .chart-section { page-break-before: always !important; width: 100% !important; height: 400px !important; }
        .toolbar, .btn { display: none !important; }
    `;
    document.head.appendChild(style);

    const opt = {
        margin: [10, 10],
        filename: 'Mon_Reporting_Tresorerie.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => { style.remove(); });
}
