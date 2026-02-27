document.addEventListener("DOMContentLoaded", () => {
    // Definitive list of 30 medical conditions for the Mega Menu
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
            
            // 1. Standardize the name for the filename
            // Replaces spaces and special characters with dashes
            // Example: "Alzheimer's Disease" -> "alzheimer-s-disease"
            const urlSafeName = disease.toLowerCase()
                .replace(/'/g, '-')     // Handle apostrophes
                .replace(/\s+/g, '-');  // Handle spaces
            
            // 2. Set the correct path to the subfolder
            // This matches the structure: Root > pages > diseases > cancer.html
            link.href = `pages/diseases/${urlSafeName}.html`;
            
            // 3. Set the visible text
            link.textContent = disease;
            
            // 4. Append to the mega menu grid
            grid.appendChild(link);
        });
    }
});

/**
 * Handles navigation redirection for Auth modules
 * @param {string} mode - signin or signup
 */
function handleAuth(mode) {
    window.location.href = `auth.html?mode=${mode}`;
}

/**
 * Global navigation handler for specific pages
 * @param {string} page - destination filename
 */
function navigateTo(page) {
    window.location.href = `${page}.html`;
}