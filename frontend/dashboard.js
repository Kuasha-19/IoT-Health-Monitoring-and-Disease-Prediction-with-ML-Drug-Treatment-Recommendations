/**
 * HealthBridge | Clinical Command Center Logic V10.0
 * Added: Heart Monitor — ECG upload, ML analysis, anomaly detection, history
 */

document.addEventListener('DOMContentLoaded', () => {
    const userName = localStorage.getItem('userName') || 'Medical Professional';
    const userId   = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole') || 'patient';

    document.getElementById('displayUserName').innerText = userName;
    document.getElementById('displayUserId').innerText   = `ID: ${userId}`;
    document.getElementById('roleBadge').innerText       = userRole.toUpperCase();

    if (userRole === 'doctor') {
        document.getElementById('doctorLinks').classList.remove('hidden');
        document.getElementById('doctorStats').classList.remove('hidden');
        document.getElementById('doctorPatientList').classList.remove('hidden');
        document.getElementById('patientLinks').classList.add('hidden');
        loadDoctorOverview();
        showSection('overview');
    } else {
        document.getElementById('patientStats').classList.remove('hidden');
        showSection('predictor');
        loadPatientOverview();
        loadReports();
        loadPatientHealthTrend();
    }

    document.getElementById('predictForm').addEventListener('submit', handlePredict);
});

// ─── SECTION TOGGLER ────────────────────────────────────────────────────────
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');

    const titles = {
        'overview':        'Overview',
        'predictor':       'AI Predictor',
        'reports':         'My Reports',
        'manage-patients': 'Patient Checkup',
        'heart-monitor':   'Heart Monitor'
    };
    document.getElementById('sectionTitle').innerText = titles[sectionId] || sectionId;

    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${sectionId}'`)) {
            link.classList.add('active');
        }
    });

    if (sectionId === 'manage-patients') {
        loadDocPatientSidebar();
    }

    if (sectionId === 'heart-monitor') {
        initEcgMonitor();
    }
}

// ─── PATIENT OVERVIEW ────────────────────────────────────────────────────────
async function loadPatientOverview() {
    const patientId = localStorage.getItem('userId');
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/reports/${patientId}`);
        const data     = await response.json();

        if (data.length > 0) {
            const latest = data[0];
            document.getElementById('latestDisease').innerText = latest.result_status;
            document.getElementById('latestRisk').innerText    = latest.analysis_score;
        } else {
            document.getElementById('latestDisease').innerText = '—';
            document.getElementById('latestRisk').innerText    = '—';
        }

        const diseaseCounts = {};
        data.forEach(report => {
            const disease = report.result_status;
            diseaseCounts[disease] = (diseaseCounts[disease] || 0) + 1;
        });

        const rankList = document.getElementById('diseaseRank');
        rankList.innerHTML = Object.entries(diseaseCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => `
                <div style="font-size:0.85rem;padding:5px 0;border-bottom:1px solid #f1f5f9;">
                    <strong>${name}</strong>: ${count} times
                </div>
            `).join('');

    } catch (err) { console.error('Patient insights failed', err); }
}

// ─── DOCTOR OVERVIEW ────────────────────────────────────────────────────────
async function loadDoctorOverview() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/doctor-stats');
        const stats    = await response.json();

        document.getElementById('totalPatients').innerText  = stats.total_patients;
        document.getElementById('totalChecks').innerText    = stats.total_checks;
        document.getElementById('respondedCount').innerText = stats.responded;
        document.getElementById('pendingCount').innerText   = stats.pending;

        const patientRes = await fetch('http://127.0.0.1:8000/api/doctor-patient-list');
        const patients   = await patientRes.json();
        const container  = document.getElementById('patientListContainer');
        container.innerHTML = patients.map(p => `
            <div class="patient-list-item">
                <div>
                    <strong>${p.name}</strong> (${p.id_str})<br>
                    <small>Latest: ${p.latest_disease} ${p.latest_risk ? '('+p.latest_risk+'%)' : ''}</small>
                </div>
                ${p.latest_risk
                    ? `<span class="risk-badge">Risk ${p.latest_risk}%</span>`
                    : '<span class="no-data">No data</span>'}
            </div>
        `).join('');
    } catch (err) { console.error('Doctor insights failed', err); }
}

// ─── MY REPORTS ─────────────────────────────────────────────────────────────
async function loadReports() {
    const patientId = localStorage.getItem('userId');
    const reportList = document.getElementById('patientReportList');

    try {
        const feedbackRes = await fetch(`http://127.0.0.1:8000/api/get-feedback/${patientId}`);
        const feedback    = await feedbackRes.json();
        if (feedback && feedback.message) {
            document.getElementById('doctorMessageArea').classList.remove('hidden');
            document.getElementById('feedbackText').innerText = `"${feedback.message}"`;
        }

        const response = await fetch(`http://127.0.0.1:8000/api/reports/${patientId}`);
        const reports  = await response.json();

        reportList.innerHTML = reports.map(r => `
            <div class="summary-card" style="margin-bottom:1rem;border-left:5px solid #8686AC;">
                <h4 style="color:#0A0A23;">${r.result_status} (Risk: ${r.analysis_score}%)</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
                    <div style="background:#F1F5F9;padding:10px;border-radius:8px;">
                        <strong>Drugs:</strong><br><small>${r.suggested_drugs}</small>
                    </div>
                    <div style="background:#F1F5F9;padding:10px;border-radius:8px;">
                        <strong>Diet:</strong><br><small>${r.suggested_foods}</small>
                    </div>
                </div>
                <p style="font-size:0.7rem;margin-top:8px;color:#64748B;">Date: ${new Date(r.created_at).toLocaleString()}</p>
            </div>
        `).join('');
    } catch (err) { console.error('Reports loading failed', err); }
}

// ─── AI PREDICTOR ────────────────────────────────────────────────────────────
async function handlePredict(e) {
    e.preventDefault();
    const userId = localStorage.getItem('userId');
    if (!userId) return alert('Please log in first.');

    const inputData = {
        user_id:          userId,
        temperature:      parseFloat(document.getElementById('temperature').value),
        heart_rate:       parseFloat(document.getElementById('heart_rate').value),
        bp_sys:           parseFloat(document.getElementById('bp_sys').value),
        bp_dia:           parseFloat(document.getElementById('bp_dia').value),
        humidity:         parseFloat(document.getElementById('humidity').value),
        fever:            parseInt(document.getElementById('fever').value),
        cough:            parseInt(document.getElementById('cough').value),
        chest_pain:       parseInt(document.getElementById('chest_pain').value),
        shortness_breath: parseInt(document.getElementById('shortness_breath').value),
        fatigue:          parseInt(document.getElementById('fatigue').value),
        headache:         parseInt(document.getElementById('headache').value)
    };

    try {
        const res    = await fetch('http://127.0.0.1:8000/api/predict', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(inputData)
        });
        const result = await res.json();
        if (res.ok) {
            document.getElementById('predictionResult').classList.remove('hidden');
            document.getElementById('predDisease').innerText = result.prediction;
            document.getElementById('predScore').innerText   = result.score;
            document.getElementById('predDrugs').innerText   = result.drugs;
            document.getElementById('predFoods').innerText   = result.foods;
            document.getElementById('predRoutine').innerText = result.routine;
            loadReports();
            loadPatientOverview();
            loadPatientHealthTrend();
        } else {
            alert('Prediction failed: ' + result.detail);
        }
    } catch (err) {
        console.error(err);
        alert('Network error.');
    }
}

// ─── DOCTOR: LOAD ALL PATIENTS ───────────────────────────────────────────────
async function loadAllPatients(side) {
    try {
        const res  = await fetch('http://127.0.0.1:8000/api/search-patient?q=');
        const list = await res.json();
        document.getElementById(`list${side}`).innerHTML = list.map(p => `
            <div class="registry-item" onclick="selectPatient('${side}', '${p.id_str}', '${p.name}')">
                <strong>${p.name}</strong><br><small>${p.id_str}</small>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

// ─── DOCTOR: PATIENT SELECTION & GRAPHS ─────────────────────────────────────
async function selectPatient(side, id_str, name) {
    document.getElementById(`data${side}`).classList.remove('hidden');
    document.getElementById(`name${side}`).innerText = `${name} // ID: ${id_str}`;
    document.getElementById(`list${side}`).innerHTML = '';

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/reports/${id_str}`);
        const data     = await response.json();
        if (data.length > 0) {
            renderPatientCharts(side, data);
            document.getElementById(`history${side}`).innerHTML = data.map(r => `
                <div style="font-size:0.75rem;border-bottom:1px solid #EEE;padding:5px 0;">
                    <strong>${r.result_status}</strong> (${new Date(r.created_at).toLocaleDateString()})<br>
                    <small>Meds: ${r.suggested_drugs}</small><br>
                    <small>Food: ${r.suggested_foods}</small>
                </div>
            `).join('');
        }
    } catch (err) { console.error('Vital loading failed', err); }
}

function renderPatientCharts(side, data) {
    const labels = data.slice(0, 5).reverse().map((_, i) => `T-${i}`);

    new Chart(document.getElementById(`chart${side}_temp`), {
        type: 'line',
        data: { labels, datasets: [{ label: 'Temp °C', data: data.slice(0,5).reverse().map(r => r.temperature), borderColor: '#FF6B6B' }] }
    });

    new Chart(document.getElementById(`chart${side}_bp`), {
        type: 'line',
        data: { labels, datasets: [
            { label: 'SYS', data: data.slice(0,5).reverse().map(r => r.bp_sys), borderColor: '#4ECDC4' },
            { label: 'DIA', data: data.slice(0,5).reverse().map(r => r.bp_dia), borderColor: '#45B7D1' }
        ]}
    });

    new Chart(document.getElementById(`chart${side}_hr`), {
        type: 'line',
        data: { labels, datasets: [{ label: 'BPM', data: data.slice(0,5).reverse().map(r => r.heart_rate), borderColor: '#8686AC' }] }
    });

    const symptomNames = ['Fever', 'Cough', 'Chest Pain', 'Shortness Breath', 'Fatigue', 'Headache'];
    const counts = [0,0,0,0,0,0];
    data.forEach(r => {
        if (r.fever > 0)            counts[0]++;
        if (r.cough > 0)            counts[1]++;
        if (r.chest_pain > 0)       counts[2]++;
        if (r.shortness_breath > 0) counts[3]++;
        if (r.fatigue > 0)          counts[4]++;
        if (r.headache > 0)         counts[5]++;
    });

    new Chart(document.getElementById(`chart${side}_symptoms`), {
        type: 'bar',
        data: { labels: symptomNames, datasets: [{ label: 'Visits with symptom', data: counts, backgroundColor: '#8686AC' }] }
    });
}

// ─── DOCTOR: LIVE SEARCH ────────────────────────────────────────────────────
async function liveSearch(side) {
    const q = document.getElementById(`input${side}`).value;
    if (q.length < 2) { loadAllPatients(side); return; }
    try {
        const res  = await fetch(`http://127.0.0.1:8000/api/search-patient?q=${q}`);
        const list = await res.json();
        document.getElementById(`list${side}`).innerHTML = list.map(p => `
            <div class="registry-item" onclick="selectPatient('${side}', '${p.id_str}', '${p.name}')">
                <strong>${p.name}</strong><br><small>${p.id_str}</small>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

// ─── DOCTOR: SEND MESSAGE ────────────────────────────────────────────────────
async function sendAdvice(side) {
    const pId = document.getElementById(`name${side}`).innerText.split('ID: ')[1];
    const msg  = document.getElementById(`msg${side}`).value;
    if (!msg) return alert('Please type a message.');

    try {
        const response = await fetch('http://127.0.0.1:8000/api/send-feedback', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ doctor_id: localStorage.getItem('userId'), patient_id: pId, message: msg })
        });
        if (response.ok) {
            alert('Message sent to patient.');
            document.getElementById(`msg${side}`).value = '';
            loadDoctorOverview();
        }
    } catch (err) { alert('Sending failed.'); }
}

// ─── PATIENT HEALTH TREND ────────────────────────────────────────────────────
async function loadPatientHealthTrend() {
    const patientId = localStorage.getItem('userId');
    try {
        const res     = await fetch(`http://127.0.0.1:8000/api/reports/${patientId}`);
        const reports = await res.json();
        const recent  = reports.slice(0, 7).reverse();
        new Chart(document.getElementById('healthChart'), {
            type: 'line',
            data: {
                labels:   recent.map((_, i) => `Visit ${i+1}`),
                datasets: [{ label: 'Risk %', data: recent.map(r => r.analysis_score), borderColor: '#8686AC', backgroundColor: 'rgba(134,134,172,0.1)' }]
            }
        });
    } catch (err) { console.error(err); }
}

// // ═══════════════════════════════════════════════════════════════════════════════
// // HEART MONITOR — ECG Analysis
// // ═══════════════════════════════════════════════════════════════════════════════

// let ecgRawData    = null;   // parsed ECG samples
// let ecgChartInst  = null;   // Chart.js instance for waveform
// let lastAnalysis  = null;   // last ML result, used for report generation

// // ─── Sub-tab switcher ────────────────────────────────────────────────────────
// function showHeartTab(tabId) {
//     document.querySelectorAll('.heart-tab-content').forEach(t => t.classList.add('hidden'));
//     document.querySelectorAll('.heart-tab').forEach(b => b.classList.remove('active'));
//     document.getElementById(tabId).classList.remove('hidden');

//     // Activate matching button
//     document.querySelectorAll('.heart-tab').forEach(b => {
//         if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${tabId}'`)) {
//             b.classList.add('active');
//         }
//     });

//     if (tabId === 'ecg-history') loadEcgHistory();
// }

// // ─── ECG File Upload ─────────────────────────────────────────────────────────
// function handleEcgUpload(event) {
//     const file = event.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = function(e) {
//         const text   = e.target.result;
//         const lines  = text.trim().split('\n');
//         // Parse: support single-column or comma-separated (take first numeric column)
//         const samples = lines
//             .map(line => parseFloat(line.split(',')[0]))
//             .filter(v => !isNaN(v));

//         if (samples.length === 0) {
//             alert('Could not parse ECG file. Ensure it contains numeric signal values.');
//             return;
//         }

//         ecgRawData = samples;
//         renderEcgWaveform(samples);
//         document.getElementById('btnRunAnalysis').disabled = false;
//         document.getElementById('ecgPlaceholder').style.display = 'none';
//     };
//     reader.readAsText(file);
// }

// // ─── Render Waveform ─────────────────────────────────────────────────────────
// function renderEcgWaveform(samples, highlightRanges) {
//     const ctx = document.getElementById('ecgWaveformChart').getContext('2d');

//     // Downsample for display performance (max 1000 pts)
//     const step        = Math.max(1, Math.floor(samples.length / 1000));
//     const displayData = samples.filter((_, i) => i % step === 0);
//     const labels      = displayData.map((_, i) => i * step);

//     // Build highlight regions as Chart.js annotation plugin OR manual shading via dataset
//     // We use a secondary dataset approach (compatible without annotation plugin)
//     const backgroundColors = displayData.map(() => 'rgba(134,134,172,0)');

//     if (highlightRanges) {
//         highlightRanges.forEach(range => {
//             const startIdx = Math.floor(range.start / step);
//             const endIdx   = Math.ceil(range.end / step);
//             for (let i = startIdx; i <= endIdx && i < backgroundColors.length; i++) {
//                 backgroundColors[i] = range.color || 'rgba(239,68,68,0.2)';
//             }
//         });
//     }

//     if (ecgChartInst) ecgChartInst.destroy();

//     ecgChartInst = new Chart(ctx, {
//         type: 'line',
//         data: {
//             labels,
//             datasets: [{
//                 label:           'ECG Signal (mV)',
//                 data:            displayData,
//                 borderColor:     '#8686AC',
//                 borderWidth:     1.5,
//                 pointRadius:     0,
//                 tension:         0.1,
//                 backgroundColor: backgroundColors,
//                 fill:            false
//             }]
//         },
//         options: {
//             animation:   false,
//             responsive:  true,
//             plugins: { legend: { display: false } },
//             scales: {
//                 x: { display: true, title: { display: true, text: 'Sample' } },
//                 y: { display: true, title: { display: true, text: 'Amplitude (mV)' } }
//             }
//         }
//     });
// }

// // ─── Run ML Analysis ─────────────────────────────────────────────────────────
// async function runEcgAnalysis() {
//     if (!ecgRawData) return;

//     const userId = localStorage.getItem('userId');
//     document.getElementById('btnRunAnalysis').innerText  = 'Analysing...';
//     document.getElementById('btnRunAnalysis').disabled   = true;

//     try {
//         const res = await fetch('http://127.0.0.1:8000/api/ecg-analyze', {
//             method:  'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body:    JSON.stringify({ user_id: userId, ecg_samples: ecgRawData })
//         });

//         if (!res.ok) throw new Error(`Server error ${res.status}`);
//         const result = await res.json();
//         lastAnalysis = result;

//         displayEcgResult(result);

//     } catch (err) {
//         console.error('ECG analysis failed', err);
//         alert('ECG analysis failed. Please check the server connection.');
//     } finally {
//         document.getElementById('btnRunAnalysis').innerText = 'Run Analysis';
//         document.getElementById('btnRunAnalysis').disabled  = false;
//     }
// }

// // ─── Display ML Result ───────────────────────────────────────────────────────
// function displayEcgResult(result) {
//     // result shape expected from backend:
//     // {
//     //   overall_status: 'Normal' | 'Warning' | 'Critical',
//     //   confidence: 0–100,
//     //   model_version: string,
//     //   signal_quality: 'Good' | 'Fair' | 'Poor',
//     //   analysed_at: ISO string,
//     //   anomalies: [
//     //     { name: string, severity: 'Critical'|'Warning'|'Normal', confidence: 0–100,
//     //       description: string, segment_start: int, segment_end: int }
//     //   ]
//     // }

//     // Show result area
//     document.getElementById('ecgResultArea').classList.remove('hidden');
//     document.getElementById('ecgReportRow').classList.remove('hidden');

//     // Status badge
//     const badge  = document.getElementById('ecgStatusBadge');
//     badge.innerText  = result.overall_status;
//     badge.className  = 'ecg-status-badge ecg-status-' + result.overall_status.toLowerCase();

//     // Meta
//     document.getElementById('ecgConfidence').innerText    = result.confidence + '%';
//     document.getElementById('ecgAnalysedAt').innerText    = new Date(result.analysed_at).toLocaleString();
//     document.getElementById('ecgModelVersion').innerText  = result.model_version || 'v1.0';
//     document.getElementById('ecgSignalQuality').innerText = result.signal_quality || '—';

//     // Anomaly list
//     const anomalyList = document.getElementById('ecgAnomalyList');
//     if (result.anomalies && result.anomalies.length > 0) {
//         anomalyList.innerHTML = result.anomalies.map((a, idx) => `
//             <div class="ecg-anomaly-item ecg-sev-${a.severity.toLowerCase()}"
//                  onclick="highlightAnomaly(${a.segment_start}, ${a.segment_end}, '${a.severity}')">
//                 <div class="ecg-anomaly-header">
//                     <span class="ecg-anomaly-name">${a.name}</span>
//                     <span class="ecg-severity-badge ecg-sev-badge-${a.severity.toLowerCase()}">${a.severity}</span>
//                     <span class="ecg-anomaly-conf">${a.confidence}% confidence</span>
//                 </div>
//                 <p class="ecg-anomaly-desc">${a.description}</p>
//             </div>
//         `).join('');

//         // Re-render waveform with highlight regions
//         const highlights = result.anomalies.map(a => ({
//             start: a.segment_start,
//             end:   a.segment_end,
//             color: a.severity === 'Critical'
//                 ? 'rgba(239,68,68,0.2)'
//                 : a.severity === 'Warning'
//                     ? 'rgba(245,158,11,0.2)'
//                     : 'rgba(34,197,94,0.1)'
//         }));
//         renderEcgWaveform(ecgRawData, highlights);
//     } else {
//         anomalyList.innerHTML = '<p class="ecg-no-anomaly">No anomalies detected. ECG appears within normal parameters.</p>';
//     }

//     // Critical alert banner
//     const hasCritical = result.anomalies && result.anomalies.some(a => a.severity === 'Critical');
//     if (hasCritical) {
//         const criticals = result.anomalies.filter(a => a.severity === 'Critical').map(a => a.name).join(', ');
//         document.getElementById('ecgAlertBanner').classList.remove('hidden');
//         document.getElementById('ecgAlertTitle').innerText = `Critical Anomaly Detected: ${criticals}`;
//         document.getElementById('ecgAlertDesc').innerText  = 'Contact your physician immediately or seek emergency care.';
//     } else if (result.overall_status === 'Warning') {
//         document.getElementById('ecgAlertBanner').classList.remove('hidden');
//         document.getElementById('ecgAlertTitle').innerText = 'Cardiac Warning — Review Required';
//         document.getElementById('ecgAlertDesc').innerText  = 'Anomalies detected. Schedule a consultation with your cardiologist.';
//     }
// }

// // ─── Highlight Anomaly Segment on Click ──────────────────────────────────────
// function highlightAnomaly(segStart, segEnd, severity) {
//     if (!ecgRawData) return;
//     const color = severity === 'Critical'
//         ? 'rgba(239,68,68,0.35)'
//         : severity === 'Warning'
//             ? 'rgba(245,158,11,0.35)'
//             : 'rgba(34,197,94,0.2)';

//     renderEcgWaveform(ecgRawData, [{ start: segStart, end: segEnd, color }]);
// }

// // ─── Dismiss Alert ───────────────────────────────────────────────────────────
// function dismissAlert() {
//     document.getElementById('ecgAlertBanner').classList.add('hidden');
// }

// // ─── Generate ECG Report ─────────────────────────────────────────────────────
// async function generateEcgReport() {
//     if (!lastAnalysis) return alert('No analysis available to export.');

//     const userId = localStorage.getItem('userId');
//     try {
//         const res = await fetch('http://127.0.0.1:8000/api/ecg-report', {
//             method:  'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body:    JSON.stringify({ user_id: userId, analysis: lastAnalysis })
//         });

//         if (!res.ok) throw new Error(`Server error ${res.status}`);
//         const blob = await res.blob();
//         const url  = window.URL.createObjectURL(blob);
//         const a    = document.createElement('a');
//         a.href     = url;
//         a.download = `ECG_Report_${userId}_${Date.now()}.pdf`;
//         a.click();
//         window.URL.revokeObjectURL(url);
//     } catch (err) {
//         console.error('Report generation failed', err);
//         alert('Report generation failed. Please check the server.');
//     }
// }

// // ─── ECG History ─────────────────────────────────────────────────────────────
// async function loadEcgHistory() {
//     const userId      = localStorage.getItem('userId');
//     const historyList = document.getElementById('ecgHistoryList');

//     try {
//         const res     = await fetch(`http://127.0.0.1:8000/api/ecg-history/${userId}`);
//         const records = await res.json();

//         if (records.length === 0) {
//             historyList.innerHTML = '<p style="color:#64748B;font-size:0.875rem;">No ECG sessions recorded yet.</p>';
//             return;
//         }

//         historyList.innerHTML = records.map(r => `
//             <div class="ecg-history-item">
//                 <div class="ecg-history-header">
//                     <div>
//                         <span class="ecg-status-badge ecg-status-${r.overall_status.toLowerCase()} ecg-badge-sm">
//                             ${r.overall_status}
//                         </span>
//                         <span class="ecg-history-date">${new Date(r.analysed_at).toLocaleString()}</span>
//                     </div>
//                     <span style="font-size:0.75rem;color:#64748B;">Model: ${r.model_version || 'v1.0'}</span>
//                 </div>
//                 <div class="ecg-history-anomalies">
//                     ${r.anomalies && r.anomalies.length > 0
//                         ? r.anomalies.map(a =>
//                             `<span class="ecg-sev-badge-${a.severity.toLowerCase()} ecg-pill">${a.name}</span>`
//                           ).join('')
//                         : '<span class="ecg-pill ecg-pill-normal">No anomalies</span>'
//                     }
//                 </div>
//                 <p style="font-size:0.75rem;color:#64748B;margin-top:6px;">
//                     Confidence: ${r.confidence}% &nbsp;|&nbsp; Signal quality: ${r.signal_quality}
//                 </p>
//             </div>
//         `).join('');

//     } catch (err) {
//         console.error('ECG history failed', err);
//         historyList.innerHTML = '<p style="color:#64748B;font-size:0.875rem;">Could not load ECG history.</p>';
//     }
// }



/* ============================================================
   HEART MONITOR — ECG Live JavaScript  v2.0
   Paste/append this into dashboard.js  (replaces any old ECG code)

   SIMULATION MODE: works without Arduino hardware.
   Toggle with the "Simulate" button that appears when no ports found.
   ============================================================ */

// ── Constants ─────────────────────────────────────────────────
const API              = 'http://127.0.0.1:8000';
const WS_BASE          = 'ws://127.0.0.1:8000';
const SAMPLE_RATE      = 360;
const SEGMENT_DURATION = 10;
const WAVEFORM_WINDOW_S = 10;
const MAX_BUFFER_S     = 300;

const CONDITION_COLORS = {
  Supraventricular: '#378ADD',
  Normal:           '#1D9E75',
  AF:               '#D4537E',
  Ventricular:      '#D85A30',
  Conduction:       '#EF9F27',
  Ischemia:         '#9333ea',
  Hypertrophy:      '#64748b',
  MI:               '#dc2626',
};

// ── State ──────────────────────────────────────────────────────
let ecgSocket        = null;
let ecgBuffer        = [];
let isConnected      = false;
let isRecording      = false;
let isSimulating     = false;
let simInterval      = null;
let simPhase         = 0;
let simScenario      = 'mixed';
let lastAnalysis     = null;
let animFrame        = null;
let ecgCanvas        = null;
let ecgCtx           = null;
let t0               = null;
let heartRateHistory = [];
let highlightRegion  = null;

// ── Simulation scenarios ───────────────────────────────────────
const SIM_SCENARIOS = {
  normal:      { label: 'Normal Sinus',        bpm: 72,  noise: 0.02, shape: 'normal'  },
  tachycardia: { label: 'Sinus Tachycardia',   bpm: 115, noise: 0.03, shape: 'tachy'   },
  bradycardia: { label: 'Bradycardia',          bpm: 42,  noise: 0.02, shape: 'brady'   },
  af:          { label: 'Atrial Fibrillation',  bpm: 90,  noise: 0.08, shape: 'af'      },
  ventricular: { label: 'Ventricular Pattern',  bpm: 80,  noise: 0.04, shape: 'ventr'   },
  mixed:       { label: 'Mixed (default demo)', bpm: 75,  noise: 0.04, shape: 'mixed'   },
};

// ── ECG waveform generator ─────────────────────────────────────
function ecgSample(phase, shape) {
  const p = phase % 1;
  let v = 0.15 * Math.exp(-Math.pow((p - 0.15) / 0.04, 2));

  if (shape === 'af') {
    v += (Math.random() - 0.5) * 0.06;
    if (p > 0.35 && p < 0.37) v -= 0.3;
    if (p > 0.37 && p < 0.40) v += 1.8 * (1 - Math.random() * 0.3);
    if (p > 0.40 && p < 0.43) v -= 0.5;
  } else if (shape === 'ventr') {
    if (p > 0.32 && p < 0.36) v -= 0.4;
    if (p > 0.36 && p < 0.45) v += 1.6 * Math.sin((p - 0.36) / 0.09 * Math.PI);
    if (p > 0.45 && p < 0.52) v -= 0.6 * Math.sin((p - 0.45) / 0.07 * Math.PI);
  } else {
    if (p > 0.34 && p < 0.36) v -= 0.25;
    if (p > 0.36 && p < 0.38) v += 1.8;
    if (p > 0.38 && p < 0.41) v -= 0.45;
    v += 0.22 * Math.exp(-Math.pow((p - 0.60) / 0.07, 2));
  }
  return v;
}

// ── Init ───────────────────────────────────────────────────────
function initEcgMonitor() {
  ecgCanvas = document.getElementById('ecgLiveCanvas');
  if (!ecgCanvas) return;
  ecgCtx = ecgCanvas.getContext('2d');
  resizeEcgCanvas();
  window.addEventListener('resize', resizeEcgCanvas);
  loadPortList();
  loadEcgHistory();
  startRenderLoop();
  injectSimDotStyle();
}

function resizeEcgCanvas() {
  if (!ecgCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  ecgCanvas.width  = ecgCanvas.offsetWidth * dpr;
  ecgCanvas.height = 180 * dpr;
  ecgCtx.setTransform(1,0,0,1,0,0);
  ecgCtx.scale(dpr, dpr);
}

// ── Port list ──────────────────────────────────────────────────
async function loadPortList() {
  const sel = document.getElementById('portSelect');
  try {
    const res   = await fetch(`${API}/api/ecg/ports`);
    const ports = await res.json();
    if (ports.length > 0) {
      sel.innerHTML = ports.map(p =>
        `<option value="${p.port}">${p.port} — ${p.description}</option>`
      ).join('');
      return;
    }
  } catch (_) { /* backend may not be running */ }

  sel.innerHTML = '<option value="__SIM__">⚡ Simulation Mode (no hardware)</option>';
  injectScenarioSelector();
}

function injectScenarioSelector() {
  if (document.getElementById('simScenarioRow')) return;
  const portRow = document.querySelector('.ecg-port-row');
  if (!portRow) return;

  const div = document.createElement('div');
  div.id = 'simScenarioRow';
  div.style.cssText = 'display:flex;gap:.5rem;align-items:center;margin-top:.4rem;flex-wrap:wrap';
  div.innerHTML = `
    <span style="font-size:.75rem;color:#64748B;white-space:nowrap">ECG Pattern:</span>
    <select id="simScenarioSelect" class="ecg-select" style="flex:1;font-size:.78rem"
            onchange="simScenario=this.value">
      ${Object.entries(SIM_SCENARIOS).map(([k,v]) =>
        `<option value="${k}"${k==='mixed'?' selected':''}>${v.label}</option>`
      ).join('')}
    </select>`;
  portRow.insertAdjacentElement('afterend', div);

  const info = document.createElement('p');
  info.style.cssText = 'font-size:.72rem;color:#b45309;margin-top:.35rem;background:#fef9c3;padding:5px 8px;border-radius:6px;line-height:1.5';
  info.innerHTML = '⚡ <strong>No hardware detected.</strong> Simulation mode generates a realistic synthetic ECG. Connect your Arduino when available.';
  div.insertAdjacentElement('afterend', info);
}

// ── Connect / Disconnect ───────────────────────────────────────
function toggleArduinoConnection() {
  if (isConnected) { disconnectArduino(); return; }
  const port = document.getElementById('portSelect').value;
  if (port === '__SIM__' || !port) {
    connectSimulation();
  } else {
    connectArduino(port);
  }
}

// ── Real Arduino via WebSocket ─────────────────────────────────
function connectArduino(port) {
  const safePort = port.replace(/\//g, '__');
  ecgSocket = new WebSocket(`${WS_BASE}/ws/ecg/${safePort}`);

  ecgSocket.onopen = () => {
    isConnected = true; isSimulating = false;
    t0 = Date.now();
    updateDeviceUI(true, false);
  };
  ecgSocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.error) { alert('Arduino: ' + msg.error); disconnectArduino(); return; }
    if (isRecording) {
      ecgBuffer.push({ t: msg.t, v: (msg.v - 512) / 512 });
      trimBuffer(); updateVitals();
    }
  };
  ecgSocket.onerror = () => { alert('WebSocket error. Is the backend running?'); disconnectArduino(); };
  ecgSocket.onclose = () => { if (isConnected) disconnectArduino(); };
}

// ── Simulation mode ────────────────────────────────────────────
function connectSimulation() {
  isConnected = true; isSimulating = true;
  t0 = Date.now(); simPhase = 0;
  updateDeviceUI(true, true);
  startSimulation();
}

function startSimulation() {
  if (simInterval) clearInterval(simInterval);
  const BATCH = 6;
  const MS_PER_BATCH = Math.round(1000 / (SAMPLE_RATE / BATCH));

  simInterval = setInterval(() => {
    if (!isConnected) { clearInterval(simInterval); return; }

    const scenario = SIM_SCENARIOS[simScenario] || SIM_SCENARIOS.mixed;
    const beatsPerSec = scenario.bpm / 60;

    for (let i = 0; i < BATCH; i++) {
      simPhase += beatsPerSec / SAMPLE_RATE;

      let shape = scenario.shape;
      if (simScenario === 'mixed') {
        // Use a rolling preview buffer length for shape, not ecgBuffer
        shape = simPhase < 20  ? 'normal'
               : simPhase < 40 ? 'tachy'
               : simPhase < 60 ? 'af'
               : simPhase < 80 ? 'ventr'
               : simPhase < 100 ? 'normal'
               : 'af';
      }

      const raw   = ecgSample(simPhase, shape);
      const noise = (Math.random() - 0.5) * scenario.noise;
      const sample = { t: Date.now() - t0, v: Math.max(-1, Math.min(1, raw + noise)) };

      // Always push to a preview buffer for vitals display
      if (!window._simPreviewBuf) window._simPreviewBuf = [];
      window._simPreviewBuf.push(sample);
      if (window._simPreviewBuf.length > SAMPLE_RATE * 10) window._simPreviewBuf.shift();

      // Only push to recording buffer when actually recording
      if (isRecording) {
        ecgBuffer.push(sample);
      }
    }

    trimBuffer();
    updateVitals(); // always update vitals regardless of recording
  }, MS_PER_BATCH);
}

function disconnectArduino() {
  if (ecgSocket)   { ecgSocket.close(); ecgSocket = null; }
  if (simInterval) { clearInterval(simInterval); simInterval = null; }
  isConnected = false; isSimulating = false; isRecording = false;
  updateDeviceUI(false, false);
  updateRecordingUI(false);
}

function trimBuffer() {
  const max = MAX_BUFFER_S * SAMPLE_RATE;
  if (ecgBuffer.length > max) ecgBuffer.splice(0, ecgBuffer.length - max);
}

// ── UI updates ─────────────────────────────────────────────────
function updateDeviceUI(connected, simMode) {
  const btn    = document.getElementById('btnConnect');
  const chip   = document.getElementById('metaStatus');
  const text   = document.getElementById('deviceStatusText');
  const btnRec = document.getElementById('btnRecord');
  const ph     = document.getElementById('ecgPlaceholder');

  if (connected) {
    btn.textContent = 'Disconnect';
    btn.classList.add('active');
    if (simMode) {
      chip.innerHTML  = '<span class="ecg-dot ecg-dot-sim"></span> Simulation';
      chip.style.cssText = 'color:#b45309;background:#fef9c3';
      text.textContent = '⚡ Simulation mode — synthetic ECG signal';
    } else {
      chip.innerHTML  = '<span class="ecg-dot ecg-dot-live"></span> Connected';
      chip.style.cssText = 'color:#15803d;background:#dcfce7';
      text.textContent = 'Arduino AD8232 — live stream active';
    }
    btnRec.disabled = false;
    ph.classList.add('hidden');
  } else {
    btn.textContent = 'Connect';
    btn.classList.remove('active');
    chip.innerHTML  = '<span class="ecg-dot ecg-dot-off"></span> Disconnected';
    chip.style.cssText = '';
    text.textContent = 'No device connected';
    btnRec.disabled = true;
    document.getElementById('btnAnalyze').disabled = true;
    ph.classList.remove('hidden');
    ['vHR','vRR','vSQ'].forEach(id => document.getElementById(id).textContent = '—');
    document.getElementById('vSamples').textContent = '0';
  }
}

// ── Recording toggle ───────────────────────────────────────────
function toggleRecording() {
  if (!isConnected) return;
  isRecording = !isRecording;
  if (isRecording) {
    ecgBuffer = []; t0 = Date.now();
    highlightRegion = null;
    document.getElementById('ecgResultArea').classList.add('hidden');
  }
  updateRecordingUI(isRecording);
}

function updateRecordingUI(rec) {
  const btn    = document.getElementById('btnRecord');
  const badge  = document.getElementById('recordingBadge');
  const btnAna = document.getElementById('btnAnalyze');
  if (rec) {
    btn.textContent = '⬛ Stop Recording';
    badge.classList.remove('hidden');
    btnAna.disabled = true;
  } else {
    btn.textContent = '● Start Recording';
    badge.classList.add('hidden');
    btnAna.disabled = ecgBuffer.length < SAMPLE_RATE * SEGMENT_DURATION;
  }
}

// ── Vitals ─────────────────────────────────────────────────────
function updateVitals() {
  const total = ecgBuffer.length;
  document.getElementById('vSamples').textContent = total.toLocaleString();
  const secs = Math.floor(total / SAMPLE_RATE);
  document.getElementById('axEnd').textContent = secs + 's';
  document.getElementById('axMid').textContent = Math.floor(secs / 2) + 's';

  // Use preview buffer for vitals when not recording, so HR/RR always shows
  const vitalsSource = (isRecording || !isSimulating)
    ? ecgBuffer
    : (window._simPreviewBuf || []);

  if (vitalsSource.length >= SAMPLE_RATE * 2) {
    const last5 = vitalsSource.slice(-SAMPLE_RATE * 5).map(s => s.v);
    let peaks = 0;
    for (let i = 2; i < last5.length - 2; i++) {
      if (last5[i] > 0.5 &&
          last5[i] > last5[i-1] && last5[i] > last5[i-2] &&
          last5[i] > last5[i+1] && last5[i] > last5[i+2]) peaks++;
    }
    const bpm = Math.round(peaks * 12);
    if (bpm > 25 && bpm < 250) {
      heartRateHistory.push(bpm);
      if (heartRateHistory.length > 8) heartRateHistory.shift();
      const avg = Math.round(heartRateHistory.reduce((a,b)=>a+b) / heartRateHistory.length);
      const hrEl = document.getElementById('vHR');
      hrEl.textContent = avg;
      hrEl.className   = 'vital-val ' + (avg < 60 || avg > 100 ? 'warn' : 'ok');
      document.getElementById('vRR').textContent = Math.round(60000 / avg);
    }
  }

  if (vitalsSource.length >= SAMPLE_RATE) {
    const recent   = vitalsSource.slice(-SAMPLE_RATE).map(s => s.v);
    const mean     = recent.reduce((a,b)=>a+b) / recent.length;
    const variance = recent.reduce((a,v)=>a+(v-mean)**2, 0) / recent.length;
    const sqEl     = document.getElementById('vSQ');
    if (variance < 0.01) {
      sqEl.textContent = 'Weak'; sqEl.className = 'vital-val bad';
    } else if (variance < 0.04) {
      sqEl.textContent = 'Fair'; sqEl.className = 'vital-val warn';
    } else {
      sqEl.textContent = isSimulating ? 'Simulated' : 'Good';
      sqEl.className   = 'vital-val ok';
    }
  }
}

// ── Render loop ────────────────────────────────────────────────
function startRenderLoop() {
  function frame() { drawEcgWaveform(); animFrame = requestAnimationFrame(frame); }
  frame();
}

function drawEcgWaveform() {
  if (!ecgCtx || !ecgCanvas) return;
  const W = ecgCanvas.offsetWidth;
  const H = 180;
  const ctx = ecgCtx;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#1a2a3a'; ctx.lineWidth = 0.5;
  for (let x=0; x<W; x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0; y<H; y+=36) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  ctx.strokeStyle = '#1e3a5a'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();

  if (highlightRegion) {
    ctx.fillStyle = highlightRegion.color;
    ctx.fillRect(highlightRegion.startPx, 0, highlightRegion.endPx - highlightRegion.startPx, H);
  }

  if (isSimulating && isRecording) {
    ctx.fillStyle = 'rgba(217,119,6,0.08)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('⚡ SIMULATION', 8, 16);
  }

  if (ecgBuffer.length === 0) {
    ctx.fillStyle = '#334155'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No signal — connect device or start simulation', W/2, H/2);
    ctx.textAlign = 'left';
    return;
  }

  const windowSamples = WAVEFORM_WINDOW_S * SAMPLE_RATE;
  const slice = ecgBuffer.slice(-Math.min(windowSamples, ecgBuffer.length));
  const traceColor = isSimulating ? '#f59e0b' : '#00d4aa';

  ctx.strokeStyle = traceColor; ctx.lineWidth = 1.5;
  ctx.shadowColor = traceColor; ctx.shadowBlur = 3;
  ctx.beginPath();
  for (let i=0; i<slice.length; i++) {
    const x = (i / (windowSamples - 1)) * W;
    const y = H/2 - slice[i].v * (H/2 - 10);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ── ML Analysis ────────────────────────────────────────────────
async function runEcgAnalysis() {
  const minSamples = SAMPLE_RATE * SEGMENT_DURATION;
  if (ecgBuffer.length < minSamples) {
    const have = Math.floor(ecgBuffer.length / SAMPLE_RATE);
    alert(`Need at least ${SEGMENT_DURATION}s of data. You have ${have}s.\n\nPress "Start Recording", wait ${SEGMENT_DURATION}s, then press "Stop Recording".`);
    return;
  }

  const userId = localStorage.getItem('userId');
  const btn    = document.getElementById('btnAnalyze');
  btn.textContent = 'Analysing…'; btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/ecg/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:          userId || 'sim-user',
        samples:          ecgBuffer.map(s => s.v),
        sample_rate:      SAMPLE_RATE,
        segment_duration: SEGMENT_DURATION,
      }),
    });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    const result = await res.json();
    lastAnalysis = result;
    displayEcgResult(result);
  } catch (err) {
    console.warn('Backend unreachable — using offline mock:', err);
    const mock = buildOfflineMockResult(userId);
    lastAnalysis = mock;
    displayEcgResult(mock);
  } finally {
    btn.textContent = 'Run ML Analysis'; btn.disabled = false;
  }
}

// ── Offline mock result ────────────────────────────────────────
function buildOfflineMockResult(userId) {
  const totalSamples = ecgBuffer.length;
  const segSize      = SAMPLE_RATE * SEGMENT_DURATION;
  const segments     = [];

  const biasMap = {
    normal:      ['Normal','Normal','Normal','Supraventricular'],
    tachycardia: ['Supraventricular','Supraventricular','Normal'],
    bradycardia: ['Conduction','Normal','Supraventricular'],
    af:          ['AF','AF','Supraventricular','Ventricular'],
    ventricular: ['Ventricular','Ventricular','AF','Supraventricular'],
    mixed:       ['Supraventricular','Normal','AF','Ventricular','Conduction','Supraventricular'],
  };
  const pool = biasMap[simScenario] || biasMap.mixed;

  for (let i=0, seg=1; i<totalSamples; i+=segSize, seg++) {
    if (i + segSize/2 > totalSamples) break;
    const condition  = pool[Math.floor(Math.random() * pool.length)];
    const confidence = +(35 + Math.random() * 30).toFixed(1);
    segments.push({
      segment: seg,
      start_s: +(i / SAMPLE_RATE).toFixed(1),
      end_s:   +((i + segSize) / SAMPLE_RATE).toFixed(1),
      condition, confidence,
      status: condition === 'Normal' ? 'Normal' : 'Abnormal',
      color:  CONDITION_COLORS[condition],
    });
  }

  if (!segments.length) segments.push({
    segment:1, start_s:0, end_s:10, condition:'Normal',
    confidence:42.0, status:'Normal', color:CONDITION_COLORS['Normal']
  });

  const total   = segments.length;
  const normSeg = segments.filter(s=>s.status==='Normal').length;
  const abnSeg  = total - normSeg;
  const condCounts = {};
  segments.forEach(s => condCounts[s.condition] = (condCounts[s.condition]||0)+1);
  const primary = Object.entries(condCounts).sort((a,b)=>b[1]-a[1])[0][0];
  const avgConf = +(segments.reduce((a,s)=>a+s.confidence,0)/total).toFixed(1);
  const abnPct  = +(abnSeg/total*100).toFixed(1);
  const overall = abnPct >= 80 ? 'Critical' : abnPct >= 30 ? 'Warning' : 'Normal';

  const condProba = {};
  Object.keys(CONDITION_COLORS).forEach(c =>
    condProba[c] = +(((condCounts[c]||0)/total)*100).toFixed(1));

  const anomalySummary = Object.entries(condCounts)
    .filter(([c])=>c!=='Normal').sort((a,b)=>b[1]-a[1])
    .map(([c,cnt])=>({
      name: c, count: cnt, pct: +(cnt/total*100).toFixed(1),
      severity: ['Ventricular','AF'].includes(c) ? 'Critical'
               : ['Supraventricular','Conduction'].includes(c) ? 'Warning' : 'Info',
      color: CONDITION_COLORS[c],
    }));

  return {
    overall_status: overall, primary_condition: primary, avg_confidence: avgConf,
    normal_pct: +(normSeg/total*100).toFixed(1), abnormal_pct: abnPct,
    total_segments: total, normal_segments: normSeg, abnormal_segments: abnSeg,
    signal_quality: 'Simulated', model_version: 'OFFLINE-SIM',
    duration_seconds: +(totalSamples/SAMPLE_RATE).toFixed(1),
    segments, condition_proba: condProba, anomaly_summary: anomalySummary,
    analysed_at: new Date().toISOString(), simulated: true,
  };
}

// ── Display result ─────────────────────────────────────────────
function displayEcgResult(result) {
  document.getElementById('ecgResultArea').classList.remove('hidden');

  const badge = document.getElementById('ecgStatusBadge');
  badge.textContent = result.overall_status + (result.simulated ? ' (simulated)' : '');
  badge.className   = 'ecg-status-badge ecg-status-' + result.overall_status.toLowerCase();

  document.getElementById('ecgPrimaryCondition').textContent = result.primary_condition;
  document.getElementById('ecgConfidence').textContent       = result.avg_confidence + '%';
  document.getElementById('ecgNormalSegs').textContent       = `${result.normal_segments} / ${result.total_segments}`;
  document.getElementById('ecgAbnormalSegs').textContent     = `${result.abnormal_segments} / ${result.total_segments}`;
  document.getElementById('ecgDuration').textContent         = result.duration_seconds + 's';
  document.getElementById('ecgSignalQuality').textContent    = result.signal_quality;

  document.getElementById('ecgVerdictBar').innerHTML = `
    <div class="vrow"><span>Assessment</span><span class="vval">${result.primary_condition}</span></div>
    <div class="vrow"><span>Normal</span><span class="vval">${result.normal_pct}% (${result.normal_segments}/${result.total_segments})</span></div>
    <div class="vrow"><span>Abnormal</span><span class="vval">${result.abnormal_pct}% (${result.abnormal_segments}/${result.total_segments})</span></div>
    ${result.simulated ? '<div class="vrow" style="color:#f59e0b"><span>Mode</span><span class="vval">⚡ Offline simulation</span></div>' : ''}
  `;

  buildSegmentBar(result.segments);
  buildAnomalyList(result.anomaly_summary);
  buildProbBars(result.condition_proba);
  buildSegmentTable(result.segments);

  const hasCritical = result.anomaly_summary.some(a => a.severity === 'Critical');
  const alertBanner = document.getElementById('ecgAlertBanner');
  if (!result.simulated && (hasCritical || result.overall_status === 'Critical')) {
    alertBanner.classList.remove('hidden');
    document.getElementById('ecgAlertTitle').textContent = 'Critical Anomaly Detected';
    document.getElementById('ecgAlertDesc').textContent  = 'Contact your physician or emergency services immediately.';
  } else if (!result.simulated && result.overall_status === 'Warning') {
    alertBanner.classList.remove('hidden');
    document.getElementById('ecgAlertTitle').textContent = 'Cardiac Warning — Review Required';
    document.getElementById('ecgAlertDesc').textContent  = 'Anomalies detected. Schedule a consultation with your cardiologist.';
  } else {
    alertBanner.classList.add('hidden');
  }

  document.getElementById('ecgResultArea').scrollIntoView({ behavior:'smooth', block:'start' });
}

// ── Prediction timeline bar ────────────────────────────────────
function buildSegmentBar(segments) {
  const bar    = document.getElementById('ecgSegBar');
  const lblRow = document.getElementById('ecgSegLabels');
  const legend = document.getElementById('ecgLegend');
  bar.innerHTML = lblRow.innerHTML = '';

  const seen = new Set(segments.map(s=>s.condition));
  legend.innerHTML = [...seen].map(c=>`
    <div class="ecg-legend-item">
      <div class="ecg-legend-dot" style="background:${CONDITION_COLORS[c]||'#888'}"></div>${c}
    </div>`).join('');

  segments.forEach((s,i) => {
    const block = document.createElement('div');
    block.className = 'ecg-seg-block';
    block.style.background = CONDITION_COLORS[s.condition] || '#888';
    block.title = `#${s.segment}: ${s.start_s}s–${s.end_s}s | ${s.condition} ${s.confidence}%`;
    block.textContent = Math.round(s.confidence) + '%';
    block.onclick = () => highlightSegment(s, i, segments.length);
    bar.appendChild(block);
    const lbl = document.createElement('span');
    lbl.textContent = (i % 5 === 0) ? s.start_s + 's' : '';
    lblRow.appendChild(lbl);
  });
}

function buildAnomalyList(anomalySummary) {
  const el = document.getElementById('ecgAnomalyList');
  if (!anomalySummary || !anomalySummary.length) {
    el.innerHTML = '<p style="font-size:.82rem;color:#64748B;">No significant anomalies detected.</p>';
    return;
  }
  el.innerHTML = anomalySummary.map(a => `
    <div class="ecg-anomaly-item">
      <div>
        <div class="ecg-anomaly-condition" style="color:${a.color}">${a.name}</div>
        <div class="ecg-anomaly-time">${a.count} segment(s) — ${a.pct}% of recording</div>
      </div>
      <span class="ecg-sev-badge ecg-sev-${a.severity.toLowerCase()}">${a.severity}</span>
    </div>`).join('');
}

function buildProbBars(conditionProba) {
  document.getElementById('ecgProbBars').innerHTML = Object.entries(conditionProba)
    .sort((a,b)=>b[1]-a[1])
    .map(([name, pct]) => `
      <div class="ecg-prob-row">
        <div class="ecg-prob-label-row">
          <span>${name}</span>
          <span style="color:${CONDITION_COLORS[name]||'#888'}">${pct}%</span>
        </div>
        <div class="ecg-prob-track">
          <div class="ecg-prob-fill"
            style="width:${Math.min(pct*4,100)}%;background:${CONDITION_COLORS[name]||'#888'}">
          </div>
        </div>
      </div>`).join('');
}

function buildSegmentTable(segments) {
  document.getElementById('ecgSegTableBody').innerHTML = segments.map((s,i) => `
    <tr class="seg-${s.status.toLowerCase()}"
        onclick="highlightSegment(${JSON.stringify(s).replace(/"/g,"'")}, ${i}, ${segments.length})"
        style="cursor:pointer">
      <td>#${s.segment}</td>
      <td>${s.start_s}s</td>
      <td>${s.end_s}s</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px">
          <span style="width:8px;height:8px;border-radius:2px;
            background:${CONDITION_COLORS[s.condition]||'#888'};display:inline-block"></span>
          ${s.condition}
        </span>
      </td>
      <td>${s.confidence}%</td>
      <td class="seg-status-${s.status.toLowerCase()}">${s.status}</td>
    </tr>`).join('');
}

function highlightSegment(seg, idx, total) {
  if (!ecgCanvas) return;
  const W = ecgCanvas.offsetWidth;
  const startPx = (idx / total) * W;
  const endPx   = ((idx + 1) / total) * W;
  const color   = seg.status === 'Normal'
    ? 'rgba(34,197,94,0.15)'
    : ['Ventricular','AF'].includes(seg.condition)
      ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)';
  highlightRegion = { startPx, endPx, color };
  setTimeout(() => { highlightRegion = null; }, 3000);
}

function dismissAlert() { document.getElementById('ecgAlertBanner').classList.add('hidden'); }

function showHeartTab(tabId, btn) {
  document.querySelectorAll('.heart-tab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');
  document.querySelectorAll('.heart-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tabId === 'ecg-history') loadEcgHistory();
}

async function loadEcgHistory() {
  const userId = localStorage.getItem('userId');
  const histEl = document.getElementById('ecgHistoryList');
  if (!histEl) return;
  try {
    const res     = await fetch(`${API}/api/ecg/history/${userId}`);
    const records = await res.json();
    if (!records.length) {
      histEl.innerHTML = '<p style="color:#64748B;font-size:.875rem;">No ECG sessions recorded yet.</p>';
      return;
    }
    histEl.innerHTML = records.map(r => {
      const anomalies = Array.isArray(r.anomaly_summary) ? r.anomaly_summary : [];
      return `
        <div class="ecg-history-item">
          <div class="ecg-history-header">
            <div style="display:flex;align-items:center;gap:.75rem">
              <span class="ecg-status-badge ecg-status-${r.overall_status.toLowerCase()}"
                    style="font-size:.75rem;padding:.25rem .75rem">${r.overall_status}</span>
              <div>
                <div style="font-weight:600;font-size:.9rem">${r.primary_condition}</div>
                <div style="font-size:.75rem;color:#64748B">${new Date(r.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div style="text-align:right;font-size:.75rem;color:#64748B">
              <div>${r.total_segments} segments · ${r.duration_seconds}s</div>
              <div>Confidence: ${r.avg_confidence}%</div>
            </div>
          </div>
          <div class="ecg-history-meta">
            <span class="ecg-history-pill normal">${r.normal_pct}% Normal</span>
            <span class="ecg-history-pill abnormal">${r.abnormal_pct}% Abnormal</span>
            ${anomalies.map(a =>
              `<span class="ecg-history-pill" style="background:${a.color}22;color:${a.color}">${a.name} ×${a.count}</span>`
            ).join('')}
          </div>
          <div style="font-size:.72rem;color:#94a3b8;margin-top:.35rem">
            Signal: ${r.signal_quality} · Model: ${r.model_version}
          </div>
        </div>`;
    }).join('');
  } catch {
    histEl.innerHTML = '<p style="color:#64748B;font-size:.875rem;">Could not load ECG history. (Backend may not be running)</p>';
  }
}

async function generateEcgReport() {
  if (!lastAnalysis) return alert('No analysis available to export.');
  try {
    const res = await fetch(`${API}/api/ecg-report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: localStorage.getItem('userId'), analysis: lastAnalysis }),
    });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `ECG_Report_${Date.now()}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  } catch {
    alert('Report generation failed or backend not running.');
  }
}

function injectSimDotStyle() {
  if (document.getElementById('simDotStyle')) return;
  const s = document.createElement('style');
  s.id = 'simDotStyle';
  s.textContent = '.ecg-dot-sim{background:#f59e0b;animation:ecgPulse 1s ease-in-out infinite}';
  document.head.appendChild(s);
}

// ── Doctor Patient Checkup — full-page layout ────────────────────────────────

let docAllPatients  = [];   // full list from API
let docSelectedId   = null; // currently selected patient ID

// Called when manage-patients section opens
async function loadDocPatientSidebar() {
  const list = document.getElementById('docPatientList');
  list.innerHTML = '<p class="doc-list-empty">Loading…</p>';

  try {
    // doctor-patient-list returns ALL patients unconditionally
    const res  = await fetch('http://127.0.0.1:8000/api/doctor-patient-list');
    const data = await res.json();

    docAllPatients = data.map(p => ({
      user_id:        p.id_str,
      name:           p.name,
      latest_disease: p.latest_disease || null,
      latest_risk:    p.latest_risk    || null
    }));

    renderDocPatientList(docAllPatients);
  } catch (err) {
    list.innerHTML = '<p class="doc-list-empty">Could not load patients.</p>';
    console.error(err);
  }
}

function renderDocPatientList(patients) {
  const list = document.getElementById('docPatientList');
  if (!patients.length) {
    list.innerHTML = '<p class="doc-list-empty">No patients found.</p>';
    return;
  }
  list.innerHTML = patients.map(p => {
    const riskColor = !p.latest_risk     ? '#94A3B8'
                    : p.latest_risk > 70  ? '#DC2626'
                    : p.latest_risk > 40  ? '#B45309'
                    :                       '#15803D';
    const riskTag = p.latest_disease
      ? `<span style="font-size:.68rem;font-weight:600;color:${riskColor}">
           ${p.latest_disease}${p.latest_risk ? ' · ' + p.latest_risk + '%' : ''}
         </span>`
      : `<span style="font-size:.68rem;color:#CBD5E1">No records yet</span>`;

    return `
      <div class="doc-patient-item ${p.user_id === docSelectedId ? 'active' : ''}"
           onclick="selectDocPatient('${p.user_id}', '${p.name}', this)">
        <div class="doc-p-avatar">${p.name[0].toUpperCase()}</div>
        <div class="doc-p-info">
          <h5>${p.name}</h5>
          <p>${p.user_id}</p>
          ${riskTag}
        </div>
      </div>
    `;
  }).join('');
}

async function filterDocPatients() {
  const q = document.getElementById('docPatientSearch').value.trim();

  // Empty search → show full cached list
  if (!q) { renderDocPatientList(docAllPatients); return; }

  // Live search against API, normalize shape to match renderer
  try {
    const res  = await fetch(`http://127.0.0.1:8000/api/search-patient?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const normalized = data.map(p => ({
      user_id:        p.id_str,
      name:           p.name,
      latest_disease: p.latest_disease || null,
      latest_risk:    p.latest_risk    || null
    }));
    renderDocPatientList(normalized);
  } catch (err) {
    console.error('Search failed', err);
  }
}

async function selectDocPatient(patientId, patientName, el) {
  // Update active state in list
  document.querySelectorAll('.doc-patient-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');

  docSelectedId = patientId;

  // Show profile content, hide empty state
  document.getElementById('docProfileEmpty').classList.add('hidden');
  document.getElementById('docProfileContent').classList.remove('hidden');

  // Fill header
  document.getElementById('docProfileName').textContent = patientName;
  document.getElementById('docProfileId').textContent   = `ID: ${patientId}`;
  document.getElementById('docProfileAvatar').textContent = patientName[0].toUpperCase();

  // Reset to vitals tab
  showDocTab('vitals', document.querySelector('.doc-ptab'));

  // Load data
  await loadDocPatientVitals(patientId);
  await loadDocPatientEcg(patientId);
}

function showDocTab(tabId, btn) {
  document.querySelectorAll('.doc-ptab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.doc-ptab').forEach(b => b.classList.remove('active'));
  document.getElementById(`doc-tab-${tabId}`).classList.remove('hidden');
  btn.classList.add('active');
}

async function loadDocPatientVitals(patientId) {
  try {
    const res  = await fetch(`${API}/api/reports/${patientId}`);
    const data = await res.json();

    // Build tags from latest report
    const tags   = document.getElementById('docProfileTags');
    tags.innerHTML = '';
    if (data.length > 0) {
      const latest = data[0];
      const risk   = parseFloat(latest.analysis_score);
      const cls    = risk > 70 ? 'danger' : risk > 40 ? 'warn' : '';
      tags.innerHTML  = `<span class="doc-tag ${cls}">${latest.result_status}</span>`;
      tags.innerHTML += `<span class="doc-tag ${cls}">Risk: ${risk}%</span>`;
    }

    // Build chart arrays
    const labels = data.map((_, i) => `#${data.length - i}`).reverse();
    const temps  = data.map(r => r.temperature).reverse();
    const hrs    = data.map(r => r.heart_rate).reverse();
    const sysBP  = data.map(r => r.bp_sys).reverse();
    const diaBP  = data.map(r => r.bp_dia).reverse();
    const syms   = data.map(r =>
      (r.fever||0)+(r.cough||0)+(r.chest_pain||0)+(r.shortness_breath||0)+(r.fatigue||0)+(r.headache||0)
    ).reverse();

    buildDocChart('docChart_temp',     labels, temps,  'Temperature (°C)', '#EF4444');
    buildDocChart('docChart_hr',       labels, hrs,    'Heart Rate (BPM)', '#3B82F6');
    buildDocChart('docChart_bp',       labels, sysBP,  'Systolic BP',      '#8B5CF6',
                                       diaBP, 'Diastolic BP',             '#A78BFA');
    buildDocChart('docChart_symptoms', labels, syms,   'Symptom Score',    '#F59E0B');

    // History vault
    const vault = document.getElementById('docProfileHistory');
    vault.innerHTML = data.slice(0, 10).map(r => `
      <div style="padding:.6rem 0;border-bottom:1px solid #F1F5F9;font-size:.8rem">
        <strong>${r.result_status}</strong> — Risk: ${r.analysis_score}%
        <br/><span style="color:#64748B">Drugs: ${r.suggested_drugs || '—'}</span>
        <br/><span style="color:#64748B">Foods: ${r.suggested_foods || '—'}</span>
      </div>
    `).join('') || '<p style="color:#94A3B8;font-size:.82rem">No history found.</p>';

  } catch (err) { console.error('Vitals load failed', err); }
}

function buildDocChart(canvasId, labels, data1, label1, color1, data2, label2, color2) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (canvas._chartInst) canvas._chartInst.destroy();
  const datasets = [{
    label: label1, data: data1, borderColor: color1,
    backgroundColor: color1 + '22', tension: .35, fill: true, pointRadius: 3
  }];
  if (data2) datasets.push({
    label: label2, data: data2, borderColor: color2,
    backgroundColor: color2 + '22', tension: .35, fill: false, pointRadius: 3
  });
  canvas._chartInst = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { labels: { font: { size: 10 } } } },
      scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } }
    }
  });
}

async function loadDocPatientEcg(patientId) {
  // Load ECG history for this patient
  const histDiv = document.getElementById('docEcgHistoryList');
  const tbody   = document.getElementById('docAnomalyTableBody');
  const verdict = document.getElementById('docVerdictBar');

  histDiv.innerHTML = '<p style="color:#64748B;font-size:.875rem;">Loading ECG history…</p>';
  tbody.innerHTML   = '<tr><td colspan="6" style="text-align:center;color:#94A3B8">Loading…</td></tr>';

  try {
    const res  = await fetch(`${API}/api/ecg/history/${patientId}`);
    const data = await res.json();

    if (!data.length) {
      histDiv.innerHTML = '<p style="color:#64748B;font-size:.875rem;">No ECG sessions recorded yet.</p>';
      tbody.innerHTML   = '<tr><td colspan="6" style="text-align:center;color:#94A3B8">No data</td></tr>';
      return;
    }

    // Render history cards
    histDiv.innerHTML = data.map(r => `
      <div class="ecg-history-card">
        <div class="ecg-history-top">
          <span class="ecg-history-label
            ${r.overall_status === 'Normal' ? 'ecg-pill-normal' : 'ecg-pill-abnormal'}">
            ${r.overall_status}
          </span>
          <span class="ecg-history-date">${new Date(r.analysed_at).toLocaleString()}</span>
        </div>
        <p style="font-size:.75rem;color:#64748B;margin-top:.3rem">
          Primary: ${r.primary_condition || '—'} &nbsp;|&nbsp;
          Confidence: ${r.confidence || '—'}% &nbsp;|&nbsp;
          Quality: ${r.signal_quality || '—'}
        </p>
      </div>
    `).join('');

    // Build HR trend from sessions
    const hrLabels = data.map((_, i) => `Session ${data.length - i}`).reverse();
    const hrValues = data.map(r => parseFloat(r.avg_heart_rate) || 0).reverse();
    buildDocChart('docEcgHRChart', hrLabels, hrValues, 'Avg Heart Rate (BPM)', '#3B82F6');

    // Anomaly log from MOST RECENT session
    const latest = data[0];
    if (latest.segments && latest.segments.length) {
      tbody.innerHTML = latest.segments.map((seg, i) => `
        <tr>
          <td>#${i+1}</td>
          <td>${seg.start_time}s</td>
          <td>${seg.end_time}s</td>
          <td>${seg.prediction}</td>
          <td>${(seg.confidence * 100).toFixed(1)}%</td>
          <td style="color:${seg.prediction === 'Normal' ? '#15803D' : '#DC2626'};font-weight:600">
            ${seg.prediction === 'Normal' ? 'Normal' : 'Abnormal'}
          </td>
        </tr>
      `).join('');

      // Verdict bar
      const abnormal = latest.segments.filter(s => s.prediction !== 'Normal').length;
      const pct      = Math.round((abnormal / latest.segments.length) * 100);
      verdict.innerHTML = `
        <div style="font-size:.8rem;color:#64748B;margin-bottom:.3rem">
          Abnormal segments: ${abnormal}/${latest.segments.length} (${pct}%)
        </div>
        <div style="background:#F1F5F9;border-radius:8px;height:10px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${pct>60?'#DC2626':pct>30?'#F59E0B':'#1D9E75'};
               border-radius:8px;transition:width .5s"></div>
        </div>`;
    } else {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94A3B8">No segment data in last session</td></tr>';
    }

  } catch (err) {
    console.error('ECG history load failed', err);
    histDiv.innerHTML = '<p style="color:#64748B;font-size:.875rem;">Could not load ECG history.</p>';
  }
}

async function sendAdviceFromProfile() {
  if (!docSelectedId) return alert('No patient selected.');
  const msg = document.getElementById('docProfileMsg').value.trim();
  if (!msg) { showDocTab('message', document.querySelectorAll('.doc-ptab')[2]); return; }

  try {
    await fetch('http://127.0.0.1:8000/api/send-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: docSelectedId,
        message:    msg,
        doctor_id:  localStorage.getItem('userId')
      })
    });
    document.getElementById('docProfileMsg').value = '';
    alert('Message sent successfully!');
  } catch (err) { console.error('Message send failed', err); }
}