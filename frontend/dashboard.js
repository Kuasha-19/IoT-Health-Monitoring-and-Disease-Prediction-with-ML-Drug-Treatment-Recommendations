/**
 * HealthBridge | Clinical Command Center Logic
 * Handles Neural Charting, Patient Registry, and Doctor-Patient Communication.
 */

let myChart = null;
let activeCharts = {}; 
let selectedIDs = { A: null, B: null }; 

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('userName');
    const userId = localStorage.getItem('userId');

    // Profile Initialization
    document.getElementById('displayUserName').innerText = name || "User";
    document.getElementById('displayUserId').innerText = `ID: ${userId}`;
    document.getElementById('welcomeName').innerText = name;
    document.getElementById('roleBadge').innerText = role ? role.toUpperCase() : "PATIENT";

    // Viewport Access Control
    if (role === 'doctor') {
        document.getElementById('doctorLinks').classList.remove('hidden');
        document.getElementById('patientLinks').classList.add('hidden');
        document.getElementById('startCheckupBtn').classList.add('hidden');
    } else {
        document.getElementById('patientLinks').classList.remove('hidden');
        document.getElementById('doctorLinks').classList.add('hidden');
        loadPatientDashboard(userId);
        loadDoctorFeedback(userId); 
    }
});

// --- I. PATIENT MODULE: REPORT & INSTRUCTION RETRIEVAL ---
async function loadPatientDashboard(userId) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/reports/${userId}`);
        const data = await res.json();
        renderMainChart(data);

        let html = '';
        data.forEach(r => {
            html += `
                <div class="report-card">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 15px;">
                        <span class="label-heading">${new Date(r.created_at).toLocaleString()}</span>
                        <span style="color:var(--accent); font-weight:800;">${r.analysis_score}% RISK_PROBABILITY</span>
                    </div>
                    <p><strong>Diagnosis:</strong> ${r.result_status}</p>
                    <p><strong>Pharmaceuticals:</strong> ${r.suggested_drugs || 'None Prescribed'}</p>
                    <p><strong>Nutritional Guidance:</strong> ${r.suggested_foods || 'Standard Diet'}</p>
                </div>`;
        });
        document.getElementById('patientReportList').innerHTML = html;
    } catch (err) { console.error("Critical error accessing clinical reports:", err); }
}

async function loadDoctorFeedback(userId) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/get-feedback/${userId}`);
        const feedback = await res.json();
        
        if (feedback.length > 0) {
            let html = '';
            feedback.forEach(f => {
                html += `
                    <div class="advice-card">
                        <span class="label-heading">Incoming Clinical Instruction</span>
                        <p style="font-size: 1.1em; font-weight: 600; margin: 10px 0;">"${f.message}"</p>
                        <small>Timestamp: ${new Date(f.prescribed_at).toLocaleString()}</small>
                    </div>`;
            });
            document.getElementById('patientAdviceArea').innerHTML = html;
        }
    } catch (err) { console.error("Error retrieving doctor feedback:", err); }
}

// --- II. DOCTOR MODULE: REGISTRY SEARCH & SPLIT VIEW ---
async function liveSearch(side) {
    const q = document.getElementById(`input${side}`).value;
    if (q.length < 2) return;
    
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/search-patient?q=${q}`);
        const patients = await res.json();
        let html = '';
        patients.forEach(p => {
            html += `<div class="patient-item" onclick="loadToSide('${p.id_str}', '${p.name}', '${side}')">
                        ${p.name.toUpperCase()} // ID: ${p.id_str}
                     </div>`;
        });
        document.getElementById(`list${side}`).innerHTML = html;
    } catch (err) { console.error("Registry search error:", err); }
}

async function loadToSide(id, name, side) {
    selectedIDs[side] = id;
    document.getElementById(`data${side}`).classList.remove('hidden');
    document.getElementById(`name${side}`).innerText = name;
    
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/reports/${id}`);
        const history = await res.json();
        renderSplitCharts(history, side);
    } catch (err) { console.error("Error loading patient analytics:", err); }
}

function renderSplitCharts(data, side) {
    const labels = data.map((_, i) => i + 1).reverse();
    const riskData = data.map(d => d.analysis_score).reverse();
    const hrData = data.map(d => d.heart_rate || 75).reverse(); 
    const bpData = data.map(d => d.bp_sys || 120).reverse();

    createChart(`chart${side}_risk`, 'NEURAL_RISK %', riskData, 'line', '#8686AC');
    createChart(`chart${side}_hr`, 'HEART_RATE (BPM)', hrData, 'bar', '#0F0E47');
    createChart(`chart${side}_bp`, 'SYSTOLIC_BP (mmHg)', bpData, 'line', '#505081');
}

function createChart(canvasId, label, data, type, color) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (activeCharts[canvasId]) activeCharts[canvasId].destroy();
    activeCharts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: data.map((_, i) => i + 1),
            datasets: [{ 
                label, 
                data, 
                borderColor: color, 
                backgroundColor: color + '22', 
                borderWidth: 2,
                pointRadius: 0,
                fill: true 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { beginAtZero: true } }
        }
    });
}

// --- III. CLINICAL ACTIONS: DEPLOY ADVICE & DATA PURGE ---
async function sendAdvice(side) {
    const pid = selectedIDs[side];
    const msg = document.getElementById(`msg${side}`).value;
    const docId = localStorage.getItem('userId');

    if (!msg) return alert("System requires instruction text.");

    try {
        const res = await fetch('http://127.0.0.1:8000/api/send-feedback', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ patient_id: pid, doctor_id: docId, message: msg })
        });
        if (res.ok) {
            alert('Clinical advice deployed to patient terminal.');
            document.getElementById(`msg${side}`).value = '';
        }
    } catch (err) { console.error("Instruction deployment failed:", err); }
}

async function deleteRecord(side) {
    if(!confirm('CONFIRM_PURGE: Permanent deletion of patient clinical history?')) return;
    const pid = selectedIDs[side];
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/delete-patient/${pid}`, { method: 'DELETE' });
        if (res.ok) location.reload();
    } catch (err) { console.error("Data purge error:", err); }
}

// --- IV. UTILITIES & GLOBAL HANDLERS ---
function renderMainChart(data) {
    const ctx = document.getElementById('healthChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.created_at).toLocaleDateString()).reverse(),
            datasets: [{ 
                label: 'Risk Progression', 
                data: data.map(d => d.analysis_score).reverse(), 
                borderColor: '#0F0E47', 
                backgroundColor: 'rgba(15, 14, 71, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('sectionTitle').innerText = id.toUpperCase();
}