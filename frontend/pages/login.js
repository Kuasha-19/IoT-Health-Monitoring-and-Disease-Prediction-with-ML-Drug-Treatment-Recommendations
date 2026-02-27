async function handleLogin(event) {
    event.preventDefault();
    
    const userId = document.getElementById('userId').value;
    // const password = document.getElementById('loginPassword').value;
try {
        const response = await fetch('http://127.0.0.1:8000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Sending userId instead of email/password to match your HTML
            body: JSON.stringify({ user_id: userId }) 
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('userId', data.user_id);
            localStorage.setItem('userName', data.name);
            localStorage.setItem('userRole', data.role);
            window.location.href = 'dashboard.html';
        } else {
            alert(data.detail || "Login failed");
        }
    } catch (error) {
        console.error("Login Error:", error);
    }
}

// Add an event listener to the form
document.getElementById('authForm').addEventListener('submit', handleLogin);