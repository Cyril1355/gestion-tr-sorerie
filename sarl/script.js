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
    tbody.innerHTML = ""; // Sécurité contre les doublons
    moisAnnee.forEach(mois => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${mois}</td>
            <td><input type="number" class="ca-brut" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td class="tva">0.00 €</td>
            <td><input type="number" class="rem-input" value="3200" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td><input type="number" class="tns-input" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td><input type="number" class="fixes-input" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td><input type="number" class="var-input" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td class="net-reel">0.00 €</td>
        `;
        tbody.appendChild(row);
    });
    calculerTotaux();
}

function calculerLigne(row) {
    const caBrut = parseFloat(row.querySelector('.ca-brut').value) || 0;
    const tva = caBrut * 0.20;
    const rem = parseFloat(row.querySelector('.rem-input').value) || 0;
    const tns = parseFloat(row.querySelector('.tns-input').value) || 0;
    const fixes = parseFloat(row.querySelector('.fixes-input').value) || 0;
    const vbles = parseFloat(row.querySelector('.var-input').value) || 0;

    row.querySelector('.tva').textContent = tva.toFixed(2) + " €";
    
    // Formule SARL : CA Brut - TVA - Rémunérations - Cotisations TNS - Frais Fixes - Factures Variables
    const netReel = caBrut - tva - rem - tns - fixes - vbles;
    const netElt = row.querySelector('.net-reel');
    netElt.textContent = netReel.toFixed(2) + " €";
    
    netElt.style.color = netReel >= 0 ? "#27ae60" : "#e74c3c";

    calculerTotaux();
}

function calculerTotaux() {
    let totaux = { ca: 0, tva: 0, rem: 0, tns: 0, fixes: 0, vbles: 0, net: 0 };
    
    document.querySelectorAll('#table-body tr').forEach(row => {
        totaux.ca += parseFloat(row.querySelector('.ca-brut').value) || 0;
        totaux.tva += parseFloat(row.querySelector('.tva').textContent) || 0;
        totaux.rem += parseFloat(row.querySelector('.rem-input').value) || 0;
        totaux.tns += parseFloat(row.querySelector('.tns-input').value) || 0;
        totaux.fixes += parseFloat(row.querySelector('.fixes-input').value) || 0;
        totaux.vbles += parseFloat(row.querySelector('.var-input').value) || 0;
        totaux.net += parseFloat(row.querySelector('.net-reel').textContent) || 0;
    });

    document.getElementById('total-ca').textContent = totaux.ca.toFixed(2) + " €";
    document.getElementById('total-tva').textContent = totaux.tva.toFixed(2) + " €";
    document.getElementById('total-rem').textContent = totaux.rem.toFixed(2) + " €";
    document.getElementById('total-tns').textContent = totaux.tns.toFixed(2) + " €";
    document.getElementById('total-fixes').textContent = totaux.fixes.toFixed(2) + " €";
    document.getElementById('total-var').textContent = totaux.vbles.toFixed(2) + " €";
    document.getElementById('total-net').textContent = totaux.net.toFixed(2) + " €";

    // Calcul de l'Impôt sur les Sociétés (IS) : 15% jusqu'à 42500€, puis 25% au-delà
    let calculIS = 0;
    if (totaux.net > 0) {
        if (totaux.net <= 42500) {
            calculIS = totaux.net * 0.15;
        } else {
            calculIS = (42500 * 0.15) + ((totaux.net - 42500) * 0.25);
        }
    }
    
    document.getElementById('total-is').textContent = calculIS.toFixed(2) + " €";
    const soldeApresIS = totaux.net - calculIS;
    document.getElementById('solde-apres-is').textContent = soldeApresIS.toFixed(2) + " €";

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
        rem: row.querySelector('.rem-input').value,
        tns: row.querySelector('.tns-input').value,
        fixes: row.querySelector('.fixes-input').value,
        vbles: row.querySelector('.var-input').value
    }));
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup_kiaelle.json';
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
                    rows[index].querySelector('.rem-input').value = item.rem !== undefined ? item.rem : 3200;
                    rows[index].querySelector('.tns-input').value = item.tns || 0;
                    rows[index].querySelector('.fixes-input').value = item.fixes || 0;
                    rows[index].querySelector('.var-input').value = item.vbles || item.frais || 0;
                    calculerLigne(rows[index]);
                }
            });
        } catch (err) {
            alert("Erreur lors de l'importation du fichier.");
        }
    };
    reader.readAsText(event.target.files[0]);
}

function initialiserGraphique() {
    const ctx = document.getElementById('beneficeChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: moisAnnee,
            datasets: [{
                label: 'Bénéfice Net Mensuel avant IS (€)',
                data: new Array(12).fill(0),
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function mettreAJourGraphique() {
    const donnees = Array.from(document.querySelectorAll('.net-reel')).map(el => parseFloat(el.textContent) || 0);
    if(chart) {
        chart.data.datasets[0].data = donnees;
        chart.update();
    }
}

function exporterPDF() {
    const element = document.getElementById('app-body');
    const style = document.createElement('style');
    style.id = 'pdf-override-style';
    style.innerHTML = `
        .container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
        .main-layout { display: flex !important; flex-direction: column !important; }
        .header-pro h1 { font-size: 16px !important; margin: 0 !important; }
        .brand img { max-height: 40px !important; }
        table { width: 100% !important; font-size: 9px !important; }
        th, td { padding: 4px 2px !important; }
        .chart-section { page-break-before: always !important; width: 100% !important; padding-top: 20px !important; height: 400px !important; }
        .toolbar, .btn { display: none !important; }
    `;
    document.head.appendChild(style);

    const opt = {
        margin: [10, 10],
        filename: 'Reporting_Kiaelle_SARL.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        style.remove();
    });
}
