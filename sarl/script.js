const moisAnnee = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
let chart;

document.addEventListener('DOMContentLoaded', () => {
    initialiserTableau();
    initialiserGraphique();
    if(localStorage.getItem('theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
});

function initialiserTableau() {
    const tbody = document.getElementById('table-body');
    moisAnnee.forEach(mois => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${mois}</td>
            <td><input type="number" class="ca-brut" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td class="tva">0.00 €</td>
            <td><input type="number" class="tns-input" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td><input type="number" class="frais" value="0" oninput="calculerLigne(this.parentElement.parentElement)"></td>
            <td class="net-reel">0.00 €</td>
        `;
        tbody.appendChild(row);
    });
}

function calculerLigne(row) {
    const caBrut = parseFloat(row.querySelector('.ca-brut').value) || 0;
    const tva = caBrut * 0.20;
    const tns = parseFloat(row.querySelector('.tns-input').value) || 0;
    const frais = parseFloat(row.querySelector('.frais').value) || 0;
    row.querySelector('.tva').textContent = tva.toFixed(2) + " €";
    const netReel = caBrut - tva - tns - frais;
    const netElt = row.querySelector('.net-reel');
    netElt.textContent = netReel.toFixed(2) + " €";
    netElt.style.color = netReel >= 0 ? "#27ae60" : "#e74c3c";
    calculerTotaux();
}

function calculerTotaux() {
    let totaux = { ca: 0, tva: 0, tns: 0, frais: 0, net: 0 };
    document.querySelectorAll('#table-body tr').forEach(row => {
        totaux.ca += parseFloat(row.querySelector('.ca-brut').value) || 0;
        totaux.tva += parseFloat(row.querySelector('.tva').textContent) || 0;
        totaux.tns += parseFloat(row.querySelector('.tns-input').value) || 0;
        totaux.frais += parseFloat(row.querySelector('.frais').value) || 0;
        totaux.net += parseFloat(row.querySelector('.net-reel').textContent) || 0;
    });
    document.getElementById('total-ca').textContent = totaux.ca.toFixed(2) + " €";
    document.getElementById('total-tva').textContent = totaux.tva.toFixed(2) + " €";
    document.getElementById('total-tns').textContent = totaux.tns.toFixed(2) + " €";
    document.getElementById('total-frais').textContent = totaux.frais.toFixed(2) + " €";
    document.getElementById('total-net').textContent = totaux.net.toFixed(2) + " €";
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
        tns: row.querySelector('.tns-input').value,
        frais: row.querySelector('.frais').value
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
        const data = JSON.parse(e.target.result);
        const rows = document.querySelectorAll('#table-body tr');
        data.forEach((item, index) => {
            if(rows[index]) {
                rows[index].querySelector('.ca-brut').value = item.ca;
                rows[index].querySelector('.tns-input').value = item.tns;
                rows[index].querySelector('.frais').value = item.frais;
                calculerLigne(rows[index]);
            }
        });
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
                label: 'Bénéfice Net (€)',
                data: new Array(12).fill(0),
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function mettreAJourGraphique() {
    const donnees = Array.from(document.querySelectorAll('.net-reel')).map(el => parseFloat(el.textContent) || 0);
    chart.data.datasets[0].data = donnees;
    chart.update();
}

function exporterPDF() {
    const element = document.getElementById('app-body');
    
    // Création du style correcteur pour forcer le tableau sur une seule page
    const style = document.createElement('style');
    style.innerHTML = `
        /* On réduit légèrement la taille globale pour l'impression */
        .container { 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 5px !important; 
        }
        
        .main-layout { 
            display: flex !important; 
            flex-direction: column !important; 
        }

        /* Optimisation du tableau pour tenir sur une page A4 */
        .table-section { 
            width: 100% !important; 
        }
        
        table { 
            width: 100% !important; 
            font-size: 9px !important; /* On réduit à 9px pour gagner de la place */
            border-collapse: collapse !important;
        }

        th, td { 
            padding: 6px 4px !important; /* On réduit l'espacement interne des cellules */
        }

        /* Empêche le tableau de se couper avant la ligne TOTAL */
        table, tr, tfoot {
            page-break-inside: avoid !important;
        }

        /* On force le graphique à démarrer sur la page 2 */
        .chart-section { 
            width: 100% !important;
            page-break-before: always !important; 
            padding-top: 20px !important;
        }

        /* Cache les éléments interactifs */
        .toolbar, .main-actions, .btn, .config-inputs { 
            display: none !important; 
        }
    `;
    document.head.appendChild(style);

    const opt = {
        margin: [5, 5], // Marges réduites (Haut/Bas, Gauche/Droite)
        filename: 'Reporting_Tresorerie_Kiaelle.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        style.remove(); // On restaure l'affichage web
    });
}
