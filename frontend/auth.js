let currentRole = 'patient';

function setRole(role) {
    currentRole = role;
    document.querySelectorAll('.role-card').forEach(card => card.classList.remove('active'));
    document.querySelector(`[data-role="${role}"]`).classList.add('active');
    
    // Toggle Department field visibility for doctors
    const deptField = document.getElementById('deptField');
    if (deptField) {
        deptField.classList.toggle('hidden', role !== 'doctor');
    }
}

function showMode(mode) {
    const isSignup = mode === 'signup';
    document.getElementById('toggleSignin').classList.toggle('active', !isSignup);
    document.getElementById('toggleSignup').classList.toggle('active', isSignup);
    document.getElementById('formTitle').innerText = isSignup ? "Create Account" : "Welcome Back";
    document.getElementById('submitBtn').innerText = isSignup ? "Sign Up" : "Sign In";
    
    // Show/Hide fields based on mode
    document.getElementById('roleSelection').classList.toggle('hidden', !isSignup);
    document.getElementById('nameField').classList.toggle('hidden', !isSignup);
    document.getElementById('contactField').classList.toggle('hidden', !isSignup);
    document.getElementById('bloodGroupField').classList.toggle('hidden', !isSignup);
    
    // Only show deptField if it's signup AND role is doctor
    if (isSignup && currentRole === 'doctor') {
        document.getElementById('deptField').classList.remove('hidden');
    } else {
        document.getElementById('deptField').classList.add('hidden');
    }
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = document.getElementById('submitBtn').innerText;
    
    // Collect data including 'dept' for doctors
    const data = {
        user_id: document.getElementById('userId').value,
        name: document.getElementById('userName').value || "User",
        email: document.getElementById('userContact').value || "N/A",
        role: currentRole,
        password: "password123", // Static password for now
        dept: document.getElementById('department') ? document.getElementById('department').value : null
    };

    const endpoint = mode === "Sign Up" ? "signup" : "login";

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (response.ok) {
            // Save specific user data to session
            localStorage.setItem('userId', result.user_id || data.user_id);
            localStorage.setItem('userName', result.name || data.name);
            localStorage.setItem('userRole', result.role || data.role);
            
            // Redirect to dashboard in the same folder
            window.location.href = 'dashboard.html';
        } else {
            alert(result.detail || "Action Failed");
        }
    } catch (err) {
        alert("Backend not responding. Please ensure uvicorn is running.");
    }
});