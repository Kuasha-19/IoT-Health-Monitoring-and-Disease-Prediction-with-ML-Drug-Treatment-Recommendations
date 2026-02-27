let currentRole = 'patient';

function setRole(role) {
    currentRole = role;
    document.querySelectorAll('.role-option').forEach(opt => opt.classList.remove('active'));
    document.querySelector(`[data-role="${role}"]`).classList.add('active');
    
    const deptField = document.getElementById('deptField');
    if (deptField) {
        deptField.classList.toggle('hidden', role !== 'doctor');
    }
}

function showMode(mode) {
    const isSignup = mode === 'signup';
    document.getElementById('toggleSignin').classList.toggle('active', !isSignup);
    document.getElementById('toggleSignup').classList.toggle('active', isSignup);
    document.getElementById('formTitle').innerText = isSignup ? "Create Account" : "Access Portal";
    document.getElementById('submitBtn').innerText = isSignup ? "Sign Up" : "Sign In";
    
    // Toggle Visibility
    document.getElementById('roleSelection').classList.toggle('hidden', !isSignup);
    document.getElementById('nameField').classList.toggle('hidden', !isSignup);
    document.getElementById('contactSection').classList.toggle('hidden', !isSignup);
    document.getElementById('bloodGroupField').classList.toggle('hidden', !isSignup);
    
    if (isSignup && currentRole === 'doctor') {
        document.getElementById('deptField').classList.remove('hidden');
    } else {
        document.getElementById('deptField').classList.add('hidden');
    }
}

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = document.getElementById('submitBtn').innerText;
    
    const email = document.getElementById('userEmail').value.trim();
    const phone = document.getElementById('userPhone').value.trim();

    // Frontend Validation: Must give at least one contact method
    if (mode === "Sign Up" && !email && !phone) {
        alert("Please provide either an Email Address or a Phone Number.");
        return;
    }

    const data = {
        user_id: document.getElementById('userId').value,
        name: document.getElementById('userName').value || "User",
        email: email || null,
        phone: phone || null,
        role: currentRole,
        password: "password123", 
        dept: currentRole === 'doctor' ? document.getElementById('department').value : null,
        blood_group: document.getElementById('bloodGroup').value || null
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
            localStorage.setItem('userId', result.user_id || data.user_id);
            localStorage.setItem('userName', result.name || data.name);
            localStorage.setItem('userRole', result.role || data.role);
            window.location.href = 'dashboard.html';
        } else {
            alert(result.detail || "Action Failed");
        }
    } catch (err) {
        alert("Backend not responding. Please ensure uvicorn is running.");
    }
});