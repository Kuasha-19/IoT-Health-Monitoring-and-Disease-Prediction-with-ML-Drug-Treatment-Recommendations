/**
 * HealthBridge | Pharmaceutical Database
 * 100 Clinical Drug Entries Categorized by Indication
 */

const drugDatabase = [
    // --- PAIN, FEVER & INFLAMMATION (1-10) ---
    { name: "Paracetamol", diseases: ["Fever", "Headache", "Body Pain"], desc: "Analgesic and antipyretic used for mild pain and fever reduction." },
    { name: "Ibuprofen", diseases: ["Arthritis", "Menstrual Pain", "Inflammation"], desc: "NSAID used for reducing hormones that cause inflammation and pain." },
    { name: "Aspirin", diseases: ["Heart Attack Risk", "Blood Clot", "Pain"], desc: "Antipyretic and blood thinner used to prevent cardiovascular events." },
    { name: "Naproxen", diseases: ["Gout", "Stiffness", "Muscle Pain"], desc: "Nonsteroidal anti-inflammatory drug used for chronic joint pain." },
    { name: "Diclofenac", diseases: ["Joint Pain", "Migraine", "Rheumatism"], desc: "Potent anti-inflammatory used for intense musculoskeletal pain." },
    { name: "Tramadol", diseases: ["Moderate Pain", "Post-Op Pain"], desc: "Opioid analgesic used when standard pain relievers fail." },
    { name: "Ketorolac", diseases: ["Severe Pain", "Inflammation"], desc: "Short-term management of moderate to severe acute pain." },
    { name: "Aceclofenac", diseases: ["Ankylosing Spondylitis", "Osteoarthritis"], desc: "Used specifically for chronic bone and joint inflammation." },
    { name: "Mefenamic Acid", diseases: ["Menstrual Cramps", "Dental Pain"], desc: "Used for short-term relief of mild to moderate pain." },
    { name: "Nimesulide", diseases: ["Acute Pain", "Dysmenorrhea"], desc: "NSAID with pain-relieving and fever-reducing properties." },

    // --- GASTROINTESTINAL & ACIDITY (11-25) ---
    { name: "Omeprazole", diseases: ["Gastritis", "Acid Reflux", "Heartburn"], desc: "Proton pump inhibitor that reduces stomach acid." },
    { name: "Pantoprazole", diseases: ["Stomach Ulcer", "Esophagitis"], desc: "Used for healing acid-related damage to the stomach lining." },
    { name: "Domperidone", diseases: ["Nausea", "Vomiting", "Indigestion"], desc: "Anti-emetic that increases movements in the digestive tract." },
    { name: "Ranitidine", diseases: ["Acidity", "Stomach Burn"], desc: "H2 blocker that reduces the amount of acid the stomach produces." },
    { name: "Metoclopramide", diseases: ["Heartburn", "Gastroparesis"], desc: "Used to treat symptoms of slow stomach emptying." },
    { name: "Loperamide", diseases: ["Diarrhea"], desc: "Slows the rhythm of digestion so the small intestines can absorb water." },
    { name: "Esomeprazole", diseases: ["GERD", "Zollinger-Ellison"], desc: "Advanced PPI for chronic acid reflux management." },
    { name: "Sucralfate", diseases: ["Duodenal Ulcer"], desc: "Forms a protective layer over ulcers to allow healing." },
    { name: "Dicyclomine", diseases: ["IBS", "Stomach Cramps"], desc: "Antispasmodic used to treat spasms of the intestines." },
    { name: "Hyoscine", diseases: ["Abdominal Pain", "Bladder Spasm"], desc: "Relaxes smooth muscle in the gastrointestinal system." },
    { name: "Bisacodyl", diseases: ["Constipation"], desc: "Stimulant laxative that increases bowel movement." },
    { name: "Meclizine", diseases: ["Motion Sickness", "Vertigo"], desc: "Antihistamine used to prevent nausea and dizziness." },
    { name: "Ondansetron", diseases: ["Severe Nausea", "Vomiting"], desc: "Used to prevent nausea caused by surgery or chemotherapy." },
    { name: "Rabeprazole", diseases: ["Acidity", "H. Pylori Infection"], desc: "Suppresses gastric acid secretion via enzyme inhibition." },
    { name: "Aluminum Hydroxide", diseases: ["Heartburn", "Acid Indigestion"], desc: "Antacid used for rapid neutralization of stomach acid." },

    // --- RESPIRATORY & ALLERGY (26-40) ---
    { name: "Salbutamol", diseases: ["Asthma", "COPD", "Bronchitis"], desc: "Quick-relief bronchodilator for respiratory distress." },
    { name: "Montelukast", diseases: ["Asthma", "Allergic Rhinitis"], desc: "Prevents wheezing and shortness of breath caused by asthma." },
    { name: "Cetirizine", diseases: ["Allergy", "Sneezing", "Itching"], desc: "Antihistamine used for common cold and hay fever symptoms." },
    { name: "Fexofenadine", diseases: ["Skin Hives", "Seasonal Allergy"], desc: "Non-drowsy allergy relief for long-term use." },
    { name: "Loratadine", diseases: ["Running Nose", "Watery Eyes"], desc: "Treats symptoms of indoor and outdoor allergies." },
    { name: "Dextromethorphan", diseases: ["Dry Cough"], desc: "Cough suppressant that affects the signals in the brain." },
    { name: "Guaifenesin", diseases: ["Chest Congestion", "Productive Cough"], desc: "Expectorant that helps thin and loosen mucus in the lungs." },
    { name: "Budesonide", diseases: ["Asthma", "Crohn's Disease"], desc: "Steroid that reduces inflammation in the respiratory tract." },
    { name: "Levocetirizine", diseases: ["Chronic Hives", "Allergy"], desc: "More potent version of cetirizine for persistent allergies." },
    { name: "Ambroxol", diseases: ["Mucus Congestion", "Sore Throat"], desc: "Secretolytic agent used for respiratory diseases with viscid mucus." },
    { name: "Theophylline", diseases: ["Asthma", "Emphysema"], desc: "Relaxes muscles in the chest and lungs to improve breathing." },
    { name: "Fluticasone", diseases: ["Nasal Congestion", "Allergy"], desc: "Nasal steroid used to reduce swelling in the nose." },
    { name: "Bromhexine", diseases: ["Cough with Phlegm"], desc: "Mucolytic used to make phlegm thinner and easier to cough up." },
    { name: "Phenylephrine", diseases: ["Sinus Congestion", "Cold"], desc: "Decongestant used to shrink blood vessels in the nasal passages." },
    { name: "Ipratropium", diseases: ["COPD Flare-up", "Asthma"], desc: "Opens up the medium and large airways in the lungs." },

    // --- CARDIOVASCULAR (41-55) ---
    { name: "Amlodipine", diseases: ["Hypertension", "Angina"], desc: "Calcium channel blocker that relaxes blood vessels." },
    { name: "Atorvastatin", diseases: ["High Cholesterol", "Heart Risk"], desc: "Lowers 'bad' cholesterol and raises 'good' cholesterol." },
    { name: "Lisinopril", diseases: ["Hypertension", "Heart Failure"], desc: "ACE inhibitor that improves survival after a heart attack." },
    { name: "Metoprolol", diseases: ["High Blood Pressure", "Chest Pain"], desc: "Beta-blocker used to treat rapid heart rates." },
    { name: "Losartan", diseases: ["Hypertension", "Kidney Damage"], desc: "Keeps blood vessels from narrowing, lowering blood pressure." },
    { name: "Furosemide", diseases: ["Edema", "Swelling"], desc: "Diuretic used to reduce excess fluid in the body." },
    { name: "Clopidogrel", diseases: ["Stroke Prevention", "Heart Attack"], desc: "Prevents platelets in your blood from sticking together." },
    { name: "Warfarin", diseases: ["Blood Clots", "Atrial Fibrillation"], desc: "Anticoagulant used to treat and prevent blood clots." },
    { name: "Spironolactone", diseases: ["Heart Failure", "High Blood Pressure"], desc: "Potassium-sparing diuretic used for fluid retention." },
    { name: "Ramipril", diseases: ["Hypertension", "Heart Failure"], desc: "Reduces blood pressure and improves cardiovascular function." },
    { name: "Rosuvastatin", diseases: ["High Cholesterol", "Atherosclerosis"], desc: "Highly potent statin for reducing lipid levels." },
    { name: "Digoxin", diseases: ["Heart Failure", "Irregular Heartbeat"], desc: "Increases the force of contraction of the heart muscle." },
    { name: "Nitroglycerin", diseases: ["Angina", "Chest Pain"], desc: "Vasodilator that opens blood vessels to improve blood flow." },
    { name: "Telmisartan", diseases: ["Hypertension", "CVD Risk"], desc: "Provides 24-hour blood pressure control." },
    { name: "Carvedilol", diseases: ["Heart Failure", "Hypertension"], desc: "Beta-blocker that also has vasodilating properties." },

    // --- ANTIBIOTICS & INFECTIONS (56-75) ---
    { name: "Amoxicillin", diseases: ["Throat Infection", "Pneumonia"], desc: "Standard antibiotic for bacterial infections." },
    { name: "Azithromycin", diseases: ["Sinusitis", "Bronchitis", "STD"], desc: "Broad-spectrum antibiotic used for respiratory infections." },
    { name: "Ciprofloxacin", diseases: ["UTI", "Typhoid", "Bone Infection"], desc: "Used for infections not responding to other antibiotics." },
    { name: "Metronidazole", diseases: ["Diarrhea", "Dental Infection"], desc: "Antibiotic used specifically for anaerobic bacteria." },
    { name: "Doxycycline", diseases: ["Acne", "Malaria Prevention"], desc: "Treats bacterial infections and prevents tropical diseases." },
    { name: "Cephalexin", diseases: ["Skin Infection", "UTI"], desc: "First-generation cephalosporin antibiotic." },
    { name: "Clarithromycin", diseases: ["H. Pylori", "Skin Infection"], desc: "Used to treat various skin and respiratory tract infections." },
    { name: "Levofloxacin", diseases: ["Pneumonia", "Sinusitis"], desc: "A fluoroquinolone used for serious bacterial infections." },
    { name: "Nitrofurantoin", diseases: ["Bladder Infection", "UTI"], desc: "Specifically targets bacteria in the urinary tract." },
    { name: "Fluconazole", diseases: ["Fungal Infection", "Candidiasis"], desc: "Used to treat infections caused by fungus." },
    { name: "Acyclovir", diseases: ["Herpes", "Chickenpox"], desc: "Antiviral drug that slows the growth of the herpes virus." },
    { name: "Clindamycin", diseases: ["Severe Infection", "Acne"], desc: "Antibiotic that treats serious internal and skin infections." },
    { name: "Sulfamethoxazole", diseases: ["UTI", "Ear Infection"], desc: "Combination antibiotic used for bacterial growth prevention." },
    { name: "Gentamicin", diseases: ["Bacterial Sepsis"], desc: "Aminoglycoside antibiotic for severe bacterial infections." },
    { name: "Moxifloxacin", diseases: ["Bronchitis", "Eye Infection"], desc: "Advanced antibiotic for resistant bacterial strains." },
    { name: "Cefuroxime", diseases: ["Gonorrhea", "Lyme Disease"], desc: "Used for a wide variety of bacterial infections." },
    { name: "Albendazole", diseases: ["Worm Infection"], desc: "Used to treat infections caused by tapeworms or pinworms." },
    { name: "Terbinafine", diseases: ["Fungal Nail Infection"], desc: "Antifungal medication taken by mouth or applied to skin." },
    { name: "Oseltamivir", diseases: ["Influenza", "Flu"], desc: "Antiviral used to treat symptoms caused by the flu virus." },
    { name: "Ketoconazole", diseases: ["Dandruff", "Skin Fungus"], desc: "Antifungal used for systemic or topical infections." },

    // --- DIABETES & METABOLISM (76-85) ---
    { name: "Metformin", diseases: ["Diabetes Type 2", "PCOS"], desc: "Lowers glucose production in the liver." },
    { name: "Gliclazide", diseases: ["Diabetes Type 2"], desc: "Stimulates insulin secretion from the pancreas." },
    { name: "Sitagliptin", diseases: ["High Blood Sugar"], desc: "Increases insulin levels after meals." },
    { name: "Pioglitazone", diseases: ["Insulin Resistance"], desc: "Improves insulin sensitivity in muscle and adipose tissue." },
    { name: "Glimepiride", diseases: ["Diabetes Type 2"], desc: "A sulfonylurea used to control blood sugar levels." },
    { name: "Levothyroxine", diseases: ["Hypothyroidism"], desc: "Synthetic thyroid hormone to replace missing levels." },
    { name: "Calcium Carbonate", diseases: ["Calcium Deficiency", "Osteoporosis"], desc: "Mineral essential for bone health and nerve function." },
    { name: "Vitamin D3", diseases: ["Bone Weakness", "Rickets"], desc: "Helps the body absorb calcium and phosphorus." },
    { name: "Ferrous Sulfate", diseases: ["Anemia", "Iron Deficiency"], desc: "Essential mineral for red blood cell production." },
    { name: "Folic Acid", diseases: ["Anemia", "Pregnancy Support"], desc: "Helps produce and maintain new cells in the body." },

    // --- MENTAL HEALTH & NEUROLOGY (86-100) ---
    { name: "Sertraline", diseases: ["Depression", "OCD", "Panic"], desc: "SSRI that helps balance serotonin in the brain." },
    { name: "Escitalopram", diseases: ["Anxiety", "Depression"], desc: "Used for generalized anxiety disorder." },
    { name: "Diazepam", diseases: ["Anxiety", "Muscle Spasms", "Seizures"], desc: "Benzodiazepine used for calming the nervous system." },
    { name: "Alprazolam", diseases: ["Panic Attacks", "Anxiety"], desc: "Provides rapid relief for acute anxiety symptoms." },
    { name: "Fluoxetine", diseases: ["Bulimia", "Depression"], desc: "SSRI used for various mood and eating disorders." },
    { name: "Amitriptyline", diseases: ["Nerve Pain", "Depression"], desc: "Tricyclic antidepressant used for sleep and pain." },
    { name: "Gabapentin", diseases: ["Nerve Pain", "Seizures"], desc: "Used to treat neuropathic pain and shingles pain." },
    { name: "Pregabalin", diseases: ["Fibromyalgia", "Nerve Pain"], desc: "Affects chemicals in the brain that send pain signals." },
    { name: "Donepezil", diseases: ["Alzheimer Disease", "Dementia"], desc: "Improves the function of nerve cells in the brain." },
    { name: "Levodopa", diseases: ["Parkinson Disease"], desc: "Converts to dopamine in the brain to treat tremors." },
    { name: "Olanzapine", diseases: ["Schizophrenia", "Bipolar"], desc: "Antipsychotic used to treat mood conditions." },
    { name: "Lorazepam", diseases: ["Acute Anxiety", "Insomnia"], desc: "Short-term treatment of severe anxiety symptoms." },
    { name: "Methylphenidate", diseases: ["ADHD", "Narcolepsy"], desc: "Stimulant used to increase focus and attention." },
    { name: "Risperidone", diseases: ["Irritability", "Bipolar"], desc: "Used to treat symptoms of mood disorders and autism." },
    { name: "Zolpidem", diseases: ["Insomnia", "Sleep Issues"], desc: "Sedative used for the short-term treatment of sleep onset." }
];

/**
 * Initialization and Search Logic
 */
function initDrugs() {
    const grid = document.getElementById('drugsGrid');
    const countDisplay = document.getElementById('visibleCount');
    
    if (grid) {
        grid.innerHTML = drugDatabase.map(drug => `
            <div class="drug-card" data-search="${drug.name.toLowerCase()} ${drug.diseases.join(' ').toLowerCase()}">
                <div class="drug-content">
                    <div class="drug-name">${drug.name}</div>
                    <div class="tag-container">
                        ${drug.diseases.map(d => `<span class="tag">${d}</span>`).join('')}
                    </div>
                    <p class="drug-desc">${drug.desc}</p>
                </div>
            </div>
        `).join('');
        
        countDisplay.textContent = drugDatabase.length;
    }
}

function filterDrugs() {
    const query = document.getElementById('drugSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.drug-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const searchText = card.getAttribute('data-search');
        if (searchText.includes(query)) {
            card.classList.remove('hidden');
            visibleCount++;
        } else {
            card.classList.add('hidden');
        }
    });

    document.getElementById('visibleCount').textContent = visibleCount;
}

document.addEventListener('DOMContentLoaded', initDrugs);