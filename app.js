// Configuration Supabase
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// État global
let currentUser = null;
let currentLab = null;
let patients = [];
let analyses = [];
let factures = [];
let revenueChart = null;
let analysesChart = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Formulaires
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
});

// Vérification auth
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        showApp();
    } else {
        showLogin();
    }
}

// Connexion
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await loadUserProfile();
        showApp();
    } catch (error) {
        alert('Erreur de connexion: ' + error.message);
    }
}

// Inscription
async function handleRegister(e) {
    e.preventDefault();
    const labName = document.getElementById('regLabName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const phone = document.getElementById('regPhone').value;
    
    try {
        // 1. Créer l'utilisateur auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (authError) throw authError;
        
        // 2. Créer le laboratoire (company)
        const { data: labData, error: labError } = await supabase
            .from('laboratoires')
            .insert([{
                nom: labName,
                email: email,
                telephone: phone,
                statut: 'actif'
            }])
            .select()
            .single();
            
        if (labError) throw labError;
        
        // 3. Créer le profil utilisateur
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: authData.user.id,
                email: email,
                laboratoire_id: labData.id,
                role: 'admin',
                nom: labName
            }]);
            
        if (profileError) throw profileError;
        
        alert('Compte créé avec succès! Vous pouvez maintenant vous connecter.');
        showLogin();
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
}

// Charger profil utilisateur
async function loadUserProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*, laboratoires(*)')
        .eq('id', currentUser.id)
        .single();
        
    if (data) {
        currentLab = data.laboratoires;
        document.getElementById('userName').textContent = data.nom || data.email;
    }
}

// Navigation
function showSection(section) {
    // Cacher toutes les sections
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(section + 'Section').classList.remove('hidden');
    
    // Mettre à jour menu actif
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    event.target.closest('li').classList.add('active');
    
    // Mettre à jour titre
    const titles = {
        'dashboard': 'Tableau de bord',
        'patients': 'Gestion des Patients',
        'analyses': 'Analyses Médicales',
        'factures': 'Facturation'
    };
    document.getElementById('pageTitle').textContent = titles[section];
    
    // Charger données spécifiques
    if (section === 'dashboard') loadDashboard();
    if (section === 'patients') loadPatients();
    if (section === 'analyses') loadAnalyses();
    if (section === 'factures') loadFactures();
}

// Dashboard
async function loadDashboard() {
    // Stats
    const { count: patientCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('laboratoire_id', currentLab.id);
        
    const { count: analyseCount } = await supabase
        .from('analyses')
        .select('*', { count: 'exact', head: true })
        .eq('laboratoire_id', currentLab.id);
        
    const { count: encoursCount } = await supabase
        .from('analyses')
        .select('*', { count: 'exact', head: true })
        .eq('laboratoire_id', currentLab.id)
        .eq('statut', 'en_cours');
    
    document.getElementById('totalPatients').textContent = patientCount || 0;
    document.getElementById('totalAnalyses').textContent = analyseCount || 0;
    document.getElementById('analysesEnCours').textContent = (encoursCount || 0) + ' en cours';
    
    // Revenus
    const { data: revenus } = await supabase
        .from('analyses')
        .select('prix')
        .eq('laboratoire_id', currentLab.id)
        .eq('statut', 'paye');
        
    const totalRevenus = revenus?.reduce((sum, a) => sum + (a.prix || 0), 0) || 0;
    document.getElementById('totalRevenus').textContent = totalRevenus.toLocaleString() + ' FCFA';
    
    // Charts
    initCharts();
    
    // Listes récentes
    loadRecentAnalyses();
    loadRecentPatients();
}

// Patients
async function loadPatients() {
    const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('laboratoire_id', currentLab.id)
        .order('created_at', { ascending: false });
        
    if (data) {
        patients = data;
        renderPatientsTable(data);
        updatePatientSelect(data);
    }
}

function renderPatientsTable(data) {
    const tbody = document.getElementById('patientsList');
    tbody.innerHTML = data.map(p => `
        <tr>
            <td>#${p.id.toString().padStart(4, '0')}</td>
            <td><strong>${p.nom}</strong></td>
            <td>${p.telephone || '-'}</td>
            <td>${p.email || '-'}</td>
            <td>${p.sexe === 'M' ? 'Masculin' : p.sexe === 'F' ? 'Féminin' : '-'}</td>
            <td>${p.date_naissance ? calculateAge(p.date_naissance) + ' ans' : '-'}</td>
            <td>
                <button class="btn btn-sm" onclick="editPatient(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deletePatient(${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function updatePatientSelect(patients) {
    const select = document.getElementById('anaPatient');
    select.innerHTML = patients.map(p => 
        `<option value="${p.id}">${p.nom} (${p.telephone})</option>`
    ).join('');
}

// Analyses
async function loadAnalyses() {
    const filter = document.getElementById('filterStatus').value;
    let query = supabase
        .from('analyses')
        .select('*, patients(nom)')
        .eq('laboratoire_id', currentLab.id)
        .order('created_at', { ascending: false });
        
    if (filter) query = query.eq('statut', filter);
    
    const { data, error } = await query;
    if (data) {
        analyses = data;
        renderAnalysesTable(data);
    }
}

function renderAnalysesTable(data) {
    const tbody = document.getElementById('analysesList');
    tbody.innerHTML = data.map(a => `
        <tr>
            <td>A-${a.id.toString().padStart(4, '0')}</td>
            <td>${a.patients?.nom || 'N/A'}</td>
            <td>${a.type_analyse}</td>
            <td>${new Date(a.created_at).toLocaleDateString('fr-FR')}</td>
            <td><span class="status status-${a.statut}">${a.statut.replace('_', ' ')}</span></td>
            <td>${a.prix?.toLocaleString()} FCFA</td>
            <td>
                <button class="btn btn-sm" onclick="viewAnalyse(${a.id})"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm" onclick="printResult(${a.id})"><i class="fas fa-print"></i></button>
            </td>
        </tr>
    `).join('');
}

// Sauvegardes
async function savePatient(e) {
    e.preventDefault();
    const patient = {
        laboratoire_id: currentLab.id,
        nom: document.getElementById('patNom').value,
        telephone: document.getElementById('patPhone').value,
        email: document.getElementById('patEmail').value,
        date_naissance: document.getElementById('patDateNaissance').value,
        sexe: document.getElementById('patSexe').value,
        groupe_sanguin: document.getElementById('patGroupeSanguin').value,
        adresse: document.getElementById('patAdresse').value
    };
    
    const { error } = await supabase.from('patients').insert([patient]);
    if (error) {
        alert('Erreur: ' + error.message);
    } else {
        closeModal('patientModal');
        loadPatients();
        document.getElementById('patientForm').reset();
    }
}

async function saveAnalyse(e) {
    e.preventDefault();
    const analyse = {
        laboratoire_id: currentLab.id,
        patient_id: document.getElementById('anaPatient').value,
        type_analyse: document.getElementById('anaType').value,
        medecin: document.getElementById('anaMedecin').value,
        prix: parseInt(document.getElementById('anaPrix').value),
        notes: document.getElementById('anaNotes').value,
        statut: 'en_cours'
    };
    
    const { error } = await supabase.from('analyses').insert([analyse]);
    if (error) {
        alert('Erreur: ' + error.message);
    } else {
        closeModal('analyseModal');
        loadAnalyses();
        document.getElementById('analyseForm').reset();
    }
}

// Charts
function initCharts() {
    const ctx1 = document.getElementById('revenueChart').getContext('2d');
    const ctx2 = document.getElementById('analysesTypeChart').getContext('2d');
    
    if (revenueChart) revenueChart.destroy();
    if (analysesChart) analysesChart.destroy();
    
    revenueChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
            datasets: [{
                label: 'Revenus (FCFA)',
                data: [150000, 230000, 180000, 320000, 290000, 450000],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
    
    analysesChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['NFS', 'Biochimie', 'Sérologie', 'Urines', 'Autres'],
            datasets: [{
                data: [30, 25, 20, 15, 10],
                backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// Utilitaires
function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.add('hidden');
}

function showRegister() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('registerScreen').classList.remove('hidden');
}

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    loadDashboard();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function openPatientModal() {
    document.getElementById('patientModal').classList.remove('hidden');
}

function openAnalyseModal() {
    document.getElementById('analyseModal').classList.remove('hidden');
}

function calculateAge(dateString) {
    const today = new Date();
    const birth = new Date(dateString);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    currentLab = null;
    showLogin();
}

// Recherche patients
function searchPatients() {
    const term = document.getElementById('searchPatients').value.toLowerCase();
    const filtered = patients.filter(p => 
        p.nom.toLowerCase().includes(term) || 
        (p.telephone && p.telephone.includes(term))
    );
    renderPatientsTable(filtered);
}