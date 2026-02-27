/**
 * HealthBridge | Master Navigation Script
 * Dynamically handles relative paths for multi-level directories.
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Determine Folder Depth and set Base Path
    const path = window.location.pathname;
    let baseRelPath = "";

    // Check if we are in a sub-sub-folder (like pages/services/ or pages/diseases/)
    if (path.includes("/services/") || path.includes("/diseases/")) {
        baseRelPath = "../../";
    } 
    // Check if we are in a sub-folder (like pages/)
    else if (path.includes("/pages/")) {
        baseRelPath = "../";
    }
    // We are at the root (index.html)
    else {
        baseRelPath = "";
    }

    // 2. Dynamic Disease Mega-Menu Generation
    const diseases = [
        "Asthma", "Alzheimer Disease", "Anemia", "Arthritis", "Bronchitis",
        "Cancer", "COVID-19", "Cholera", "Chronic Kidney Disease", "Dengue",
        "Diabetes", "Depression", "Epilepsy", "Gastritis", "Heart Attack",
        "Hepatitis B", "HIV AIDS", "Hypertension", "Hypotension", "Influenza",
        "Leukemia", "Liver Cirrhosis", "Malaria", "Migraine", "Obesity",
        "Pneumonia", "Psoriasis", "Stroke", "Tuberculosis", "Typhoid"
    ];

    const grid = document.getElementById('diseaseGrid');
    
    if (grid) {
        diseases.forEach(disease => {
            const link = document.createElement('a');
            // Format name for file matching (e.g., "Heart Attack" -> "heart-attack")
            const urlSafeName = disease.toLowerCase()
                .replace(/'/g, '-')
                .replace(/\s+/g, '-');
            
            // Build the dynamic path based on folder depth
            link.href = `${baseRelPath}pages/diseases/${urlSafeName}.html`;
            link.textContent = disease;
            grid.appendChild(link);
        });
    }
});

/**
 * Global Navigation Helper for Auth Mode
 */
function handleAuth(mode) {
    const path = window.location.pathname;
    let authPath = 'auth.html';
    
    if (path.includes("/services/") || path.includes("/diseases/")) {
        authPath = '../../auth.html';
    } else if (path.includes("/pages/")) {
        authPath = '../auth.html';
    }
    
    window.location.href = `${authPath}?mode=${mode}`;
}