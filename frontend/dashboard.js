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
        loadAllPatients('A');
        loadAllPatients('B');
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



//initECGMonitor()
/* ============================================================
   HEART MONITOR — ECG Live JavaScript
   Paste/append this into dashboard.js  (replaces any old ECG code)
   ============================================================ */

// ── Constants ─────────────────────────────────────────────────
const API = 'http://127.0.0.1:8000';
const WS_BASE = 'ws://127.0.0.1:8000';
const SAMPLE_RATE = 360;            // Hz (match your Arduino sketch)
const SEGMENT_DURATION = 10;        // seconds per ML window
const WAVEFORM_WINDOW_S = 10;       // seconds shown on canvas at once
const MAX_BUFFER_S = 300;           // max seconds to buffer (5 min)

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
let ecgSocket      = null;        // WebSocket to backend
let ecgBuffer      = [];          // raw sample buffer [{t, v}]
let isConnected    = false;
let isRecording    = false;
let lastAnalysis   = null;        // most recent ML result
let animFrame      = null;
let ecgCanvas      = null;
let ecgCtx         = null;
let t0             = null;        // recording start time (ms)
let heartRateHistory = [];        // last N computed BPM values
let highlightRegion  = null;      // {startPx, endPx, color}

// ── Init (called by showSection in dashboard.js) ───────────────
function initEcgMonitor() {
  ecgCanvas = document.getElementById('ecgLiveCanvas');
  if (!ecgCanvas) return;
  ecgCtx = ecgCanvas.getContext('2d');
  resizeEcgCanvas();
  window.addEventListener('resize', resizeEcgCanvas);
  loadPortList();
  loadEcgHistory();
  startRenderLoop();
}

function resizeEcgCanvas() {
  if (!ecgCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w   = ecgCanvas.offsetWidth;
  const h   = 180;
  ecgCanvas.width  = w * dpr;
  ecgCanvas.height = h * dpr;
  ecgCtx.scale(dpr, dpr);
}

// ── Port list ──────────────────────────────────────────────────
async function loadPortList() {
  const sel = document.getElementById('portSelect');
  try {
    const res   = await fetch(`${API}/api/ecg/ports`);
    const ports = await res.json();
    if (ports.length === 0) {
      sel.innerHTML = '<option value="">No serial ports found</option>';
      return;
    }
    sel.innerHTML = ports.map(p =>
      `<option value="${p.port}">${p.port} — ${p.description}</option>`
    ).join('');
  } catch {
    sel.innerHTML = '<option value="">Server unreachable</option>';
  }
}

// ── Connect / Disconnect Arduino ───────────────────────────────
function toggleArduinoConnection() {
  if (isConnected) {
    disconnectArduino();
  } else {
    connectArduino();
  }
}

function connectArduino() {
  const portSel = document.getElementById('portSelect');
  const port    = portSel.value;
  if (!port) return alert('Please select a serial port first.');

  // Encode "/" for URL safety (Linux ports like /dev/ttyUSB0)
  const safePort = port.replace(/\//g, '__');
  ecgSocket = new WebSocket(`${WS_BASE}/ws/ecg/${safePort}`);

  ecgSocket.onopen = () => {
    isConnected = true;
    t0 = Date.now();
    updateDeviceUI(true);
    console.log('ECG WebSocket connected');
  };

  ecgSocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.error) {
      alert('Arduino error: ' + msg.error);
      disconnectArduino();
      return;
    }
    if (isRecording) {
      // Normalise raw ADC (0–1023) to -1…+1
      const normalised = (msg.v - 512) / 512;
      ecgBuffer.push({ t: msg.t, v: normalised });

      // Trim buffer to MAX_BUFFER_S
      const maxSamples = MAX_BUFFER_S * SAMPLE_RATE;
      if (ecgBuffer.length > maxSamples) {
        ecgBuffer.splice(0, ecgBuffer.length - maxSamples);
      }

      updateVitals();
    }
  };

  ecgSocket.onerror = () => {
    alert('WebSocket error — check the backend is running and the port is correct.');
    disconnectArduino();
  };

  ecgSocket.onclose = () => {
    if (isConnected) disconnectArduino();
  };
}

function disconnectArduino() {
  if (ecgSocket) { ecgSocket.close(); ecgSocket = null; }
  isConnected = false;
  isRecording = false;
  updateDeviceUI(false);
  updateRecordingUI(false);
}

function updateDeviceUI(connected) {
  const btn    = document.getElementById('btnConnect');
  const chip   = document.getElementById('metaStatus');
  const text   = document.getElementById('deviceStatusText');
  const btnRec = document.getElementById('btnRecord');
  const btnAna = document.getElementById('btnAnalyze');

  if (connected) {
    btn.textContent = 'Disconnect';
    btn.classList.add('active');
    chip.innerHTML  = '<span class="ecg-dot ecg-dot-live"></span> Connected';
    chip.style.color = '#15803d';
    chip.style.background = '#dcfce7';
    text.textContent = 'Arduino AD8232 — live stream active';
    btnRec.disabled  = false;
    document.getElementById('ecgPlaceholder').classList.add('hidden');
  } else {
    btn.textContent = 'Connect';
    btn.classList.remove('active');
    chip.innerHTML  = '<span class="ecg-dot ecg-dot-off"></span> Disconnected';
    chip.style.color = '';
    chip.style.background = '';
    text.textContent = 'No device connected';
    btnRec.disabled  = true;
    btnAna.disabled  = true;
    document.getElementById('ecgPlaceholder').classList.remove('hidden');
    document.getElementById('vHR').textContent = '—';
    document.getElementById('vRR').textContent = '—';
    document.getElementById('vSQ').textContent = '—';
    document.getElementById('vSamples').textContent = '0';
  }
}

// ── Recording toggle ───────────────────────────────────────────
function toggleRecording() {
  if (!isConnected) return;
  isRecording = !isRecording;
  if (isRecording) {
    ecgBuffer = [];
    t0 = Date.now();
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
    btnAna.disabled = ecgBuffer.length === 0;
  }
}

// ── Vitals update ──────────────────────────────────────────────
function updateVitals() {
  const total = ecgBuffer.length;
  document.getElementById('vSamples').textContent = total.toLocaleString();

  const secs = Math.floor(total / SAMPLE_RATE);
  document.getElementById('axEnd').textContent = secs + 's';
  document.getElementById('axMid').textContent = Math.floor(secs / 2) + 's';

  // Estimate HR from zero-crossings in last 5s
  if (total >= SAMPLE_RATE * 2) {
    const last5 = ecgBuffer.slice(-SAMPLE_RATE * 5).map(s => s.v);
    let crossings = 0;
    for (let i = 1; i < last5.length; i++) {
      if (last5[i - 1] < 0.2 && last5[i] >= 0.2) crossings++;
    }
    const bpm = Math.round(crossings * 12);  // crossings per 5s → per min
    if (bpm > 30 && bpm < 220) {
      heartRateHistory.push(bpm);
      if (heartRateHistory.length > 10) heartRateHistory.shift();
      const avgBPM = Math.round(heartRateHistory.reduce((a, b) => a + b) / heartRateHistory.length);
      const hrEl = document.getElementById('vHR');
      hrEl.textContent = avgBPM;
      hrEl.className = 'vital-val ' + (avgBPM < 60 || avgBPM > 100 ? 'warn' : 'ok');
      const rr = Math.round(60000 / avgBPM);
      document.getElementById('vRR').textContent = rr;
    }
  }

  // Signal quality from recent amplitude variance
  if (total >= SAMPLE_RATE) {
    const recent = ecgBuffer.slice(-SAMPLE_RATE).map(s => s.v);
    const mean   = recent.reduce((a, b) => a + b) / recent.length;
    const variance = recent.reduce((a, v) => a + (v - mean) ** 2, 0) / recent.length;
    const sqEl   = document.getElementById('vSQ');
    if (variance < 0.01) {
      sqEl.textContent = 'Weak'; sqEl.className = 'vital-val bad';
    } else if (variance < 0.05) {
      sqEl.textContent = 'Fair'; sqEl.className = 'vital-val warn';
    } else {
      sqEl.textContent = 'Good'; sqEl.className = 'vital-val ok';
    }
  }
}

// ── Render loop ────────────────────────────────────────────────
function startRenderLoop() {
  function frame() {
    drawEcgWaveform();
    animFrame = requestAnimationFrame(frame);
  }
  frame();
}

// ── Waveform drawing ───────────────────────────────────────────
function drawEcgWaveform() {
  if (!ecgCtx || !ecgCanvas) return;
  const W   = ecgCanvas.offsetWidth;
  const H   = 180;
  const ctx = ecgCtx;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#1a2a3a';
  ctx.lineWidth   = 0.5;
  for (let x = 0; x < W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 36) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Centre line
  ctx.strokeStyle = '#1e3a5a';
  ctx.lineWidth   = 0.8;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  // Highlight region (clicked anomaly)
  if (highlightRegion) {
    ctx.fillStyle = highlightRegion.color;
    ctx.fillRect(highlightRegion.startPx, 0,
      highlightRegion.endPx - highlightRegion.startPx, H);
  }

  if (!isConnected && ecgBuffer.length === 0) {
    // Demo / idle animation
    drawIdleAnimation(ctx, W, H);
    return;
  }

  if (ecgBuffer.length === 0) return;

  // Draw the most recent WAVEFORM_WINDOW_S of buffered data
  const windowSamples = WAVEFORM_WINDOW_S * SAMPLE_RATE;
  const slice = ecgBuffer.slice(-Math.min(windowSamples, ecgBuffer.length));

  ctx.strokeStyle = '#00d4aa';
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = '#00d4aa';
  ctx.shadowBlur  = 3;
  ctx.beginPath();

  slice.forEach((pt, i) => {
    const x = (i / (windowSamples - 1)) * W;
    const y = H / 2 - pt.v * (H / 2 - 10);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });

  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Idle pulse animation when no device
let idlePhase = 0;
function drawIdleAnimation(ctx, W, H) {
  idlePhase += 0.025;
  ctx.strokeStyle = '#1e4060';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  for (let i = 0; i < W; i++) {
    const x   = i;
    const xN  = (i / W) * 4 + idlePhase;
    const mod = xN % 1;
    let y;
    if      (mod < 0.1)  y = H / 2 - mod * 60;
    else if (mod < 0.15) y = H / 2 - 6 + (mod - 0.1) * 20;
    else if (mod < 0.45) y = H / 2 + 3 * Math.sin((mod - 0.15) * 30);
    else if (mod < 0.5)  y = H / 2 - (mod - 0.45) * 320;
    else if (mod < 0.55) y = H / 2 + 16 + (mod - 0.5) * 240;
    else if (mod < 0.65) y = H / 2 - (mod - 0.55) * 80;
    else                  y = H / 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ── ML Analysis ────────────────────────────────────────────────
async function runEcgAnalysis() {
  if (ecgBuffer.length < SAMPLE_RATE * SEGMENT_DURATION) {
    alert(`Need at least ${SEGMENT_DURATION}s of recorded data. Currently have ${Math.floor(ecgBuffer.length / SAMPLE_RATE)}s.`);
    return;
  }

  const userId = localStorage.getItem('userId');
  const btn    = document.getElementById('btnAnalyze');
  btn.textContent = 'Analysing…';
  btn.disabled    = true;

  try {
    const res = await fetch(`${API}/api/ecg/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:          userId,
        samples:          ecgBuffer.map(s => s.v),
        sample_rate:      SAMPLE_RATE,
        segment_duration: SEGMENT_DURATION,
      }),
    });

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const result = await res.json();
    lastAnalysis = result;
    displayEcgResult(result);

  } catch (err) {
    console.error('ECG analysis failed', err);
    alert('ECG analysis failed. Check that the backend is running.');
  } finally {
    btn.textContent = 'Run ML Analysis';
    btn.disabled    = false;
  }
}

// ── Display ML result ──────────────────────────────────────────
function displayEcgResult(result) {
  document.getElementById('ecgResultArea').classList.remove('hidden');

  // Status badge
  const badge = document.getElementById('ecgStatusBadge');
  badge.textContent = result.overall_status;
  badge.className   = 'ecg-status-badge ecg-status-' + result.overall_status.toLowerCase();

  // Summary meta
  document.getElementById('ecgPrimaryCondition').textContent = result.primary_condition;
  document.getElementById('ecgConfidence').textContent       = result.avg_confidence + '%';
  document.getElementById('ecgNormalSegs').textContent       = `${result.normal_segments} / ${result.total_segments}`;
  document.getElementById('ecgAbnormalSegs').textContent     = `${result.abnormal_segments} / ${result.total_segments}`;
  document.getElementById('ecgDuration').textContent         = result.duration_seconds + 's';
  document.getElementById('ecgSignalQuality').textContent    = result.signal_quality;

  // Verdict bar
  document.getElementById('ecgVerdictBar').innerHTML = `
    <div class="vrow"><span>Assessment</span><span class="vval">${result.primary_condition}</span></div>
    <div class="vrow"><span>Normal</span><span class="vval">${result.normal_pct}% (${result.normal_segments}/${result.total_segments})</span></div>
    <div class="vrow"><span>Abnormal</span><span class="vval">${result.abnormal_pct}% (${result.abnormal_segments}/${result.total_segments})</span></div>
  `;

  // Prediction timeline bars
  buildSegmentBar(result.segments);

  // Anomaly list
  buildAnomalyList(result.anomaly_summary, result.segments);

  // Probability bars
  buildProbBars(result.condition_proba);

  // Segment table
  buildSegmentTable(result.segments);

  // Alert banner
  const hasCritical = result.anomaly_summary.some(a => a.severity === 'Critical');
  const alertBanner = document.getElementById('ecgAlertBanner');
  if (hasCritical || result.overall_status === 'Critical') {
    alertBanner.classList.remove('hidden');
    document.getElementById('ecgAlertTitle').textContent =
      hasCritical ? 'Critical Anomaly Detected — Seek immediate medical attention' : 'Critical ECG Pattern Detected';
    document.getElementById('ecgAlertDesc').textContent =
      'Contact your physician or emergency services immediately.';
  } else if (result.overall_status === 'Warning') {
    alertBanner.classList.remove('hidden');
    document.getElementById('ecgAlertTitle').textContent = 'Cardiac Warning — Review Required';
    document.getElementById('ecgAlertDesc').textContent  =
      'Anomalies detected. Schedule a consultation with your cardiologist.';
  } else {
    alertBanner.classList.add('hidden');
  }

  // Scroll into view
  document.getElementById('ecgResultArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Prediction timeline bar ────────────────────────────────────
function buildSegmentBar(segments) {
  const bar     = document.getElementById('ecgSegBar');
  const lblRow  = document.getElementById('ecgSegLabels');
  const legend  = document.getElementById('ecgLegend');

  bar.innerHTML = lblRow.innerHTML = '';

  // Legend (unique conditions)
  const seen = new Set();
  segments.forEach(s => seen.add(s.condition));
  legend.innerHTML = [...seen].map(c => `
    <div class="ecg-legend-item">
      <div class="ecg-legend-dot" style="background:${CONDITION_COLORS[c] || '#888'}"></div>
      ${c}
    </div>
  `).join('');

  segments.forEach((s, i) => {
    const block = document.createElement('div');
    block.className = 'ecg-seg-block';
    block.style.background = CONDITION_COLORS[s.condition] || '#888';
    block.title = `${s.segment}: ${s.start_s}s–${s.end_s}s | ${s.condition} ${s.confidence}%`;
    block.textContent = Math.round(s.confidence) + '%';
    block.onclick = () => highlightSegment(s, i, segments.length);
    bar.appendChild(block);

    const lbl = document.createElement('span');
    lbl.textContent = (i % 5 === 0) ? s.start_s + 's' : '';
    lblRow.appendChild(lbl);
  });
}

// ── Anomaly list ───────────────────────────────────────────────
function buildAnomalyList(anomalySummary, segments) {
  const el = document.getElementById('ecgAnomalyList');
  if (!anomalySummary || anomalySummary.length === 0) {
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
    </div>
  `).join('');
}

// ── Probability bars ───────────────────────────────────────────
function buildProbBars(conditionProba) {
  const el = document.getElementById('ecgProbBars');
  const sorted = Object.entries(conditionProba).sort((a, b) => b[1] - a[1]);
  el.innerHTML = sorted.map(([name, pct]) => `
    <div class="ecg-prob-row">
      <div class="ecg-prob-label-row">
        <span>${name}</span>
        <span style="color:${CONDITION_COLORS[name] || '#888'}">${pct}%</span>
      </div>
      <div class="ecg-prob-track">
        <div class="ecg-prob-fill"
          style="width:${Math.min(pct * 4, 100)}%;background:${CONDITION_COLORS[name] || '#888'}">
        </div>
      </div>
    </div>
  `).join('');
}

// ── Segment table ──────────────────────────────────────────────
function buildSegmentTable(segments) {
  const tbody = document.getElementById('ecgSegTableBody');
  tbody.innerHTML = segments.map(s => `
    <tr class="seg-${s.status.toLowerCase()}" onclick="highlightSegment(s, ${s.segment - 1}, ${segments.length})" style="cursor:pointer">
      <td>#${s.segment}</td>
      <td>${s.start_s}s</td>
      <td>${s.end_s}s</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px">
          <span style="width:8px;height:8px;border-radius:2px;background:${CONDITION_COLORS[s.condition] || '#888'};display:inline-block"></span>
          ${s.condition}
        </span>
      </td>
      <td>${s.confidence}%</td>
      <td class="seg-status-${s.status.toLowerCase()}">${s.status}</td>
    </tr>
  `).join('');
}

// ── Highlight waveform region ──────────────────────────────────
function highlightSegment(seg, idx, total) {
  if (!ecgCanvas) return;
  const W = ecgCanvas.offsetWidth;
  const startPx = (idx / total) * W;
  const endPx   = ((idx + 1) / total) * W;
  const sev     = seg.status === 'Normal' ? 'rgba(34,197,94,0.15)' :
                  (seg.condition === 'Ventricular' || seg.condition === 'AF')
                    ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)';
  highlightRegion = { startPx, endPx, color: sev };
  setTimeout(() => { highlightRegion = null; }, 3000);
}

// ── Dismiss alert ──────────────────────────────────────────────
function dismissAlert() {
  document.getElementById('ecgAlertBanner').classList.add('hidden');
}

// ── Heart tab switcher ─────────────────────────────────────────
function showHeartTab(tabId, btn) {
  document.querySelectorAll('.heart-tab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');
  document.querySelectorAll('.heart-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tabId === 'ecg-history') loadEcgHistory();
}

// ── ECG History ────────────────────────────────────────────────
async function loadEcgHistory() {
  const userId  = localStorage.getItem('userId');
  const histEl  = document.getElementById('ecgHistoryList');
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
              <span class="ecg-status-badge ecg-status-${r.overall_status.toLowerCase()}" style="font-size:.75rem;padding:.25rem .75rem">
                ${r.overall_status}
              </span>
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
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('ECG history load failed', err);
    histEl.innerHTML = '<p style="color:#64748B;font-size:.875rem;">Could not load ECG history.</p>';
  }
}

// ── Generate PDF report ────────────────────────────────────────
async function generateEcgReport() {
  if (!lastAnalysis) return alert('No analysis available to export.');
  const userId = localStorage.getItem('userId');
  try {
    const res = await fetch(`${API}/api/ecg-report`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: userId, analysis: lastAnalysis }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `ECG_Report_${userId}_${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Report generation failed', err);
    alert('Report generation failed. Check the backend.');
  }
}

