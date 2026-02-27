document.addEventListener("DOMContentLoaded", () => {
    const navHTML = `
    <nav class="navbar">
      <div class="logo" onclick="location.href = '/index.html'">
        <span>HealthBridge</span>
      </div>

      <ul class="nav-links">
        <li class="nav-item mega-dropdown">
          <a href="#">Disease</a>
          <div class="mega-menu">
            <div class="mega-menu-content">
              <h3 class="menu-title">Medical Conditions and Diseases</h3>
              <div class="mega-menu-grid" id="diseaseGrid"></div>
            </div>
          </div>
        </li>

        <li class="nav-item">
          <a href="#">Services</a>
          <div class="dropdown">
            <a href="/pages/services/heart-risk.html">Heart Risk</a>
            <a href="/pages/services/fever.html">Fever Respiratory</a>
            <a href="/pages/services/hypertension.html">Hypertension</a>
            <a href="/pages/services/hypotension.html">Hypotension</a>
            <a href="/pages/services/normal.html">General Checkup</a>
          </div>
        </li>

        <li class="nav-item"><a href="/pages/wellness.html">Wellness</a></li>
        <li class="nav-item"><a href="/pages/primary-drugs.html">Primary Drugs</a></li>
        <li class="nav-item"><a href="/pages/foods.html">Foods</a></li>
        <li class="nav-item"><a href="/pages/contact.html">Contact</a></li>
      </ul>

      <div class="nav-auth">
        <button class="btn btn-login" onclick="handleAuth('signin')">Sign In</button>
        <button class="btn btn-signup" onclick="handleAuth('signup')">Sign Up</button>
      </div>
    </nav>`;

    // Insert the navbar at the start of the body
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    // Initialize the Disease Mega Menu Logic
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
            const urlSafeName = disease.toLowerCase().replace(/'/g, '-').replace(/\s+/g, '-');
            link.href = `/pages/diseases/${urlSafeName}.html`;
            link.textContent = disease;
            grid.appendChild(link);
        });
    }
});

// Auth Handler
function handleAuth(mode) {
    window.location.href = `/auth.html?mode=${mode}`;
}