let myChart = null;
let activeCharts = {}; // স্প্লিট গ্রাফগুলো স্টোর করার জন্য
let selectedIDs = { A: null, B: null }; // বর্তমানে সিলেক্টেড পেশেন্টদের আইডি

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('userName');
    const userId = localStorage.getItem('userId');

    // প্রোফাইল সেটআপ
    document.getElementById('displayUserName').innerText = name || "User";
    document.getElementById('displayUserId').innerText = `ID: ${userId}`;
    document.getElementById('welcomeName').innerText = name;
    document.getElementById('roleBadge').innerText = role ? role.toUpperCase() : "PATIENT";

    // রোল অনুযায়ী ভিউ কন্ট্রোল
    if (role === 'doctor') {
        document.getElementById('doctorLinks').classList.remove('hidden');
        document.getElementById('patientLinks').classList.add('hidden');
        document.getElementById('startCheckupBtn').classList.add('hidden');
    } else {
        document.getElementById('patientLinks').classList.remove('hidden');
        document.getElementById('doctorLinks').classList.add('hidden');
        loadPatientDashboard(userId);
        loadDoctorFeedback(userId); // পেশেন্টের জন্য ডক্টরের মেসেজ লোড করা
    }
});

// --- ১. পেশেন্ট ড্যাশবোর্ড লজিক (রিপোর্ট ও ডক্টরের মেসেজ) ---
async function loadPatientDashboard(userId) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/reports/${userId}`);
        const data = await res.json();
        renderMainChart(data);

        let html = '<h3>History Records (Recent First)</h3>';
        data.forEach(r => {
            html += `
                <div class="report-card">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${new Date(r.created_at).toLocaleString()}</strong>
                        <span style="color:#2563eb;">${r.analysis_score}% Risk</span>
                    </div>
                    <p><strong>Diagnosis:</strong> ${r.result_status}</p>
                    <p><strong>Prescribed Drugs:</strong> ${r.suggested_drugs || 'N/A'}</p>
                    <p><strong>Diet:</strong> ${r.suggested_foods || 'N/A'}</p>
                </div>`;
        });
        document.getElementById('patientReportList').innerHTML = html;
    } catch (err) { console.error("Error loading dashboard:", err); }
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
                        <h4><i class="fas fa-user-md"></i> Doctor's Instruction</h4>
                        <p style="font-size: 1.1em;">"${f.message}"</p>
                        <small>Received: ${new Date(f.prescribed_at).toLocaleString()}</small>
                    </div>`;
            });
            document.getElementById('patientAdviceArea').innerHTML = html;
        }
    } catch (err) { console.error("Error loading feedback:", err); }
}

// --- ২. ডক্টর ড্যাশবোর্ড লজিক (সার্চ, স্প্লিট ভিউ ও ৩টি গ্রাফ) ---
async function liveSearch(side) {
    const q = document.getElementById(`input${side}`).value;
    if (q.length < 2) return;
    
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/search-patient?q=${q}`);
        const patients = await res.json();
        let html = '';
        patients.forEach(p => {
            html += `<div class="patient-item" onclick="loadToSide('${p.id_str}', '${p.name}', '${side}')">
                        ${p.name} (${p.id_str})
                     </div>`;
        });
        document.getElementById(`list${side}`).innerHTML = html;
    } catch (err) { console.error("Search error:", err); }
}

async function loadToSide(id, name, side) {
    selectedIDs[side] = id;
    document.getElementById(`data${side}`).classList.remove('hidden');
    document.getElementById(`name${side}`).innerText = name;
    
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/reports/${id}`);
        const history = await res.json();
        renderSplitCharts(history, side);
    } catch (err) { console.error("Error loading patient details:", err); }
}

function renderSplitCharts(data, side) {
    const labels = data.map((_, i) => i + 1).reverse();
    const riskData = data.map(d => d.analysis_score).reverse();
    // দ্রষ্টব্য: ডাটাবেসে হার্ট রেট ও বিপি কলাম থাকলে সেগুলো ব্যবহার করুন
    const hrData = data.map(d => d.heart_rate || 75).reverse(); 
    const bpData = data.map(d => d.bp_sys || 120).reverse();

    createChart(`chart${side}_risk`, 'Risk Trend %', riskData, 'line', '#ef4444');
    createChart(`chart${side}_hr`, 'Heart Rate (BPM)', hrData, 'bar', '#3b82f6');
    createChart(`chart${side}_bp`, 'Blood Pressure (Sys)', bpData, 'line', '#10b981');
}

function createChart(canvasId, label, data, type, color) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (activeCharts[canvasId]) activeCharts[canvasId].destroy();
    activeCharts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: data.map((_, i) => i + 1),
            datasets: [{ label, data, borderColor: color, backgroundColor: color + '33', fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- ৩. ডক্টর অ্যাকশন (মেসেজ পাঠানো ও ডিলিট করা) ---
async function sendAdvice(side) {
    const pid = selectedIDs[side];
    const msg = document.getElementById(`msg${side}`).value;
    const docId = localStorage.getItem('userId');

    if (!msg) return alert("Please type a message first.");

    try {
        const res = await fetch('http://127.0.0.1:8000/api/send-feedback', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ patient_id: pid, doctor_id: docId, message: msg })
        });
        if (res.ok) {
            alert('Advice sent directly to patient!');
            document.getElementById(`msg${side}`).value = '';
        }
    } catch (err) { console.error("Error sending feedback:", err); }
}

async function deleteRecord(side) {
    if(!confirm('Are you sure you want to delete all records for this patient?')) return;
    const pid = selectedIDs[side];
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/delete-patient/${pid}`, { method: 'DELETE' });
        if (res.ok) location.reload();
    } catch (err) { console.error("Delete error:", err); }
}

// --- হেল্পার ফাংশনসমূহ ---
function renderMainChart(data) {
    const ctx = document.getElementById('healthChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.created_at).toLocaleDateString()).reverse(),
            datasets: [{ label: 'Risk Trend %', data: data.map(d => d.analysis_score).reverse(), borderColor: '#2563eb', fill: true }]
        }
    });
}

function showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('sectionTitle').innerText = id.toUpperCase();
}