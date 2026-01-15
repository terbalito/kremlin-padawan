/**
 * LexPrep - Core Logic
 */

// State Management
const State = {
    questions: [],
    currentMode: 'landing',
    currentQuestionIndex: 0,
    userAnswers: [],
    examTimeRemaining: 3600,
    examTimerInterval: null,
    examQuestions: [],
    theme: localStorage.getItem('theme') || 'light'
};

// UI Elements
const views = {
    landing: document.getElementById('view-landing'),
    upload: document.getElementById('view-upload'),
    training: document.getElementById('view-training'),
    examRules: document.getElementById('view-exam-rules'),
    examSession: document.getElementById('view-exam-session'),
    results: document.getElementById('view-results'),
    sessionSetup: document.getElementById('view-session-setup') 
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadStoredData();
    setupEventListeners();
    updateStats();
});

function initTheme() {
    document.documentElement.setAttribute('data-theme', State.theme);
    updateThemeIcon();
}

function updateThemeIcon() {
    // Icons handle themselves via CSS selector [data-theme]
}

function loadStoredData() {
    const stored = localStorage.getItem('lexprep_questions');
    if (stored) {
        try {
            State.questions = JSON.parse(stored);
        } catch (e) {
            console.error("Failed to load questions", e);
        }
    }
}

function updateStats() {
    const display = document.getElementById('count-display');
    const summary = document.getElementById('stats-summary');
    if (State.questions.length > 0) {
        display.textContent = State.questions.length;
        summary.classList.remove('hidden');
    } else {
        summary.classList.add('hidden');
    }
}

// Router-ish navigation
function navigateTo(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    if (views[viewName]) {
        views[viewName].classList.add('active');
        State.currentMode = viewName;
    }
    window.scrollTo(0, 0);
}

// Event Listeners
function setupEventListeners() {
    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        State.theme = State.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', State.theme);
        initTheme();
    });

    // Landing Buttons
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.dataset.mode;
            if (State.questions.length === 0) {
                showToast("Veuillez d'abord importer des questions.");
                navigateTo('upload');
                return;
            }
            // On affiche le setup avant de commencer
            setupSession(mode);
        });
    });


    // Upload Data Click
    document.getElementById('data-btn').addEventListener('click', () => navigateTo('upload'));
    document.getElementById('drop-zone').addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    document.getElementById('process-text').addEventListener('click', handleTextImport);

    // Back Buttons
    document.querySelectorAll('.back-link').forEach(btn => {
        btn.addEventListener('click', () => {
            if (State.currentMode === 'examSession') {
                if (!confirm("Quitter l'examen ? Votre progression sera perdue.")) return;
                clearInterval(State.examTimerInterval);
            }
            navigateTo('landing');
        });
    });

    // Training Actions
    document.getElementById('train-show-answer').addEventListener('click', showTrainingFeedback);
    document.getElementById('train-next').addEventListener('click', nextTrainingQuestion);

    // Exam Actions
    document.getElementById('start-exam-btn').addEventListener('click', startExam);
    document.getElementById('exam-prev').addEventListener('click', () => switchExamQuestion(State.currentQuestionIndex - 1));
    document.getElementById('exam-next').addEventListener('click', () => switchExamQuestion(State.currentQuestionIndex + 1));
    document.getElementById('finish-exam-btn').addEventListener('click', finishExam);

    // Auto-expanding textarea
    document.querySelectorAll('.auto-expand').forEach(ta => {
        ta.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    });
}

function setupSession(mode) {
    State.selectedMode = mode; // On garde le mode choisi
    navigateTo('sessionSetup');

    document.getElementById('start-session-btn').onclick = () => {
        const numQuestions = parseInt(document.getElementById('num-questions').value);
        const timeLimit = parseInt(document.getElementById('time-limit').value);

        if (mode === 'training') startTraining(numQuestions);
        else startExam(numQuestions, timeLimit);
    };


    // Annuler
    document.querySelector('#view-session-setup .back-link').onclick = () => navigateTo('landing');
}


// Data Handling
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target.result;
        if (file.name.endsWith('.json')) {
            try {
                const data = JSON.parse(content);
                saveQuestions(data);
            } catch (err) {
                showToast("Erreur lors de la lecture du JSON.");
            }
        } else {
            processRawText(content);
        }
    };
    reader.readAsText(file);
}

function handleTextImport() {
    const text = document.getElementById('raw-text-import').value;
    if (!text.trim()) return;
    processRawText(text);
}

function processRawText(text) {
    // Parsing logic for OCR text
    // Expected format: QUESTION: text... REPONSE: text... MOTS CLES: word, word
    const blocks = text.split(/QUESTION:/i).filter(b => b.trim());
    const parsed = blocks.map((block, index) => {
        const parts = block.split(/REPONSE:/i);
        const questionText = parts[0]?.trim();
        let answerText = "";
        let keywords = [];

        if (parts[1]) {
            const answerParts = parts[1].split(/MOTS CLES:|MOTS-CLÉS:/i);
            answerText = answerParts[0]?.trim();
            if (answerParts[1]) {
                keywords = answerParts[1].split(',').map(k => k.trim());
            }
        }

        return {
            id: Date.now() + index,
            question: questionText,
            reponse: answerText,
            motsCles: keywords
        };
    }).filter(q => q.question && q.reponse);

    if (parsed.length > 0) {
        saveQuestions(parsed);
        document.getElementById('raw-text-import').value = "";
    } else {
        showToast("Aucune question valide détectée.");
    }
}

function saveQuestions(newQuestions) {
    State.questions = newQuestions;
    localStorage.setItem('lexprep_questions', JSON.stringify(State.questions));
    updateStats();
    showToast(`${newQuestions.length} questions chargées.`);
    navigateTo('landing');
}

// Training Mode Logic
function startTraining(numQuestions = 10) {
    // Tirage aléatoire des questions pour la session training
    State.trainingQuestions = [...State.questions].sort(() => Math.random() - 0.5).slice(0, numQuestions);
    State.currentQuestionIndex = 0;
    State.userAnswers = new Array(State.trainingQuestions.length).fill("");
    navigateTo('training');
    renderTrainingQuestion();
}



function renderTrainingQuestion() {
    const q = State.trainingQuestions[State.currentQuestionIndex]; // <-- utilise trainingQuestions
    document.getElementById('train-current').textContent = `${State.currentQuestionIndex + 1} / ${State.trainingQuestions.length}`;
    document.getElementById('train-question').innerHTML = formatTextForHTML(q.question);
    const answerArea = document.getElementById('train-answer');
    answerArea.value = "";
    answerArea.style.height = 'auto';
    
    document.getElementById('train-feedback').classList.add('hidden');
    document.getElementById('train-show-answer').classList.remove('hidden');
    document.getElementById('train-next').classList.add('hidden');
}

function formatTextForHTML(text = "") {
    return text
        // transforme \\n (texte brut) en vrais \n
        .replace(/\\n/g, '\n')
        // transforme \n en <br>
        .replace(/\n/g, '<br>')
        // nettoie les doubles <br>
        .replace(/(<br>\s*){2,}/g, '<br><br>')
        .trim();
}




function showTrainingFeedback() {
    const q = State.trainingQuestions[State.currentQuestionIndex]; // <-- utilise trainingQuestions
    const feedback = document.getElementById('train-feedback');
    const officialAnswer = document.getElementById('train-official-answer');
    const kwContainer = document.getElementById('train-keywords');

    const userText = document.getElementById('train-answer').value;
    const score = evaluateAnswer(userText, q.motsCles, q.reponse);

    officialAnswer.innerHTML = formatTextForHTML(q.reponse);


    feedback.classList.remove('good', 'average', 'bad');

    if (score >= 70) feedback.classList.add('good');
    else if (score >= 40) feedback.classList.add('average');
    else feedback.classList.add('bad');

    const existing = feedback.querySelector('.result-badge');
    if (existing) existing.remove();

    officialAnswer.insertAdjacentHTML(
        'beforebegin',
        `<div class="result-badge">${score}% de couverture des mots-clés</div>`
    );

    kwContainer.innerHTML = q.motsCles.map(k => `<span class="keyword-pill">${k}</span>`).join('');

    feedback.classList.remove('hidden');
    document.getElementById('train-show-answer').classList.add('hidden');
    document.getElementById('train-next').classList.remove('hidden');
}

function nextTrainingQuestion() {
    // Sauvegarde réponse utilisateur
    State.userAnswers[State.currentQuestionIndex] = document.getElementById('train-answer').value;
    State.currentQuestionIndex++;

    if (State.currentQuestionIndex < State.trainingQuestions.length) {
        renderTrainingQuestion();
    } else {
        // Session terminée
        const finalScore = calculateFinalScore(State.trainingQuestions, State.userAnswers);
        showToast(`Session terminée ! Score final : ${finalScore}%`);
        navigateTo('landing');
    }
}

function calculateFinalScore(questions, userAnswers, seuil = 7) {
    let totalScore = 0;
    questions.forEach((q, idx) => {
        const score = evaluateAnswer(userAnswers[idx] || "", q.motsCles, q.reponse, seuil);
        totalScore += score;
    });
    return Math.round(totalScore / questions.length);
}

// Exam Mode Logic
function startExam(numQuestions = 10, timeLimit = 60) {
    State.examQuestions = [...State.questions].sort(() => Math.random() - 0.5).slice(0, numQuestions);
    State.userAnswers = new Array(State.examQuestions.length).fill("");
    State.currentQuestionIndex = 0;
    State.examTimeRemaining = timeLimit * 60; // secondes
    navigateTo('examSession');
    renderExamQuestion();
    startExamTimer();
    renderExamDots();
}


function startExamTimer() {
    if (State.examTimerInterval) clearInterval(State.examTimerInterval);
    const timerDisplay = document.getElementById('exam-timer');
    
    State.examTimerInterval = setInterval(() => {
        State.examTimeRemaining--;
        const mins = Math.floor(State.examTimeRemaining / 60);
        const secs = State.examTimeRemaining % 60;
        timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (State.examTimeRemaining <= 0) {
            clearInterval(State.examTimerInterval);
            finishExam();
            showToast("Temps écoulé !");
        }
    }, 1000);
}

function renderExamQuestion() {
    const q = State.examQuestions[State.currentQuestionIndex];
    document.getElementById('exam-question-text').innerHTML = formatTextForHTML(q.question);
    const input = document.getElementById('exam-answer-input');
    input.value = State.userAnswers[State.currentQuestionIndex] || "";
    input.style.height = 'auto';
    input.style.height = (input.scrollHeight) + 'px';

    document.getElementById('exam-prev').disabled = State.currentQuestionIndex === 0;
    document.getElementById('exam-next').textContent = (State.currentQuestionIndex === State.examQuestions.length - 1) ? "Terminer" : "Suivant";

    // Update dots
    document.querySelectorAll('.nav-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === State.currentQuestionIndex);
        dot.classList.toggle('completed', State.userAnswers[idx] && State.userAnswers[idx].trim().length > 0);
    });
}

function switchExamQuestion(index) {
    if (index < 0) return;
    if (index >= State.examQuestions.length) {
        finishExam();
        return;
    }
    // Save current answer
    State.userAnswers[State.currentQuestionIndex] = document.getElementById('exam-answer-input').value;
    State.currentQuestionIndex = index;
    renderExamQuestion();
}

function renderExamDots() {
    const container = document.getElementById('exam-nav-dots');
    container.innerHTML = '';
    State.examQuestions.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.className = 'nav-dot';
        dot.addEventListener('click', () => switchExamQuestion(idx));
        container.appendChild(dot);
    });
}

function finishExam() {
    // Save the last answer
    State.userAnswers[State.currentQuestionIndex] = document.getElementById('exam-answer-input').value;
    
    playFinishSound();
    navigateTo('results');
    renderResults();

}

function renderResults() {
    const container = document.getElementById('results-list');
    container.innerHTML = '';

    let bonnes = 0;
    let mauvaises = 0;
    let totalScore = 0;

    // 1️⃣ Calcul des scores
    const details = State.examQuestions.map((q, idx) => {
        const score = evaluateAnswer(
            State.userAnswers[idx] || "",
            q.motsCles,
            q.reponse
        );

        totalScore += score;

        if (score >= 70) bonnes++;
        else mauvaises++;

        return { q, idx, score };
    });

    const totalQuestions = State.examQuestions.length;
    const scoreGlobal = Math.round(totalScore / totalQuestions);
    const pctBonnes = Math.round((bonnes / totalQuestions) * 100);
    const pctMauvaises = 100 - pctBonnes;

    // 2️⃣ SCORE GLOBAL (TRÈS VISIBLE)
    container.insertAdjacentHTML('beforeend', `
        <div class="exam-score-main">
            <div class="score-big">${scoreGlobal}%</div>
            <div class="score-label">Score final</div>

            <div class="score-stats">
                <div class="stat good">
                    <strong>${pctBonnes}%</strong>
                    <span>Bonnes réponses</span>
                </div>
                <div class="stat bad">
                    <strong>${pctMauvaises}%</strong>
                    <span>Mauvaises réponses</span>
                </div>
            </div>

            <div class="result-filters">
                <button data-filter="all">Toutes</button>
                <button data-filter="good">Réussies</button>
                <button data-filter="bad">Échouées</button>
            </div>
        </div>
    `);

    // 3️⃣ FEEDBACK QUESTION PAR QUESTION
    details.forEach(({ q, idx, score }) => {
        const cls = score >= 70 ? 'good' : 'bad';

        const item = document.createElement('div');
        item.className = `result-item ${cls}`;
        item.dataset.type = cls;

        item.innerHTML = `
            <div class="result-header">
                <strong>Question ${idx + 1}</strong>
                <span class="result-badge">${score}%</span>
            </div>

            <p class="question-text">${formatTextForHTML(q.question)}</p>

            <div class="answer-box">
                <h5>Votre réponse</h5>
                <p>${State.userAnswers[idx] || "<em>Aucune réponse</em>"}</p>
            </div>

            <div class="answer-box official">
                <h5>Réponse officielle</h5>
                <p>${formatTextForHTML(q.reponse)}</p>
            </div>
        `;

        container.appendChild(item);
    });

    // 4️⃣ FILTRES
    document.querySelectorAll('.result-filters button').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;

            document.querySelectorAll('.result-item').forEach(item => {
                item.style.display =
                    filter === 'all' || item.dataset.type === filter
                        ? 'block'
                        : 'none';
            });
        });
    });
}



// Utils
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function normalizeText(str) {
    return str
        .toLowerCase()
        .normalize("NFD")               // sépare lettres + accents
        .replace(/[\u0300-\u036f]/g, ""); // supprime les accents
}



function evaluateAnswer(userText, questionData) {
    if (!userText || !userText.trim()) return 0;

    const normalize = str =>
        str.toLowerCase()
           .normalize("NFD")
           .replace(/[\u0300-\u036f]/g, "")
           .replace(/[^a-z\s]/g, "")
           .replace(/\s+/g, " ")
           .trim();

    const user = normalize(userText);

    const essentiels = questionData.motsClesEssentiels || questionData.motsCles || [];
    const secondaires = questionData.motsClesSecondaires || [];
    const erreursGraves = questionData.erreursGraves || [];

    let score = 0;
    let maxScore = 0;

    // 1️⃣ Concepts essentiels (70%)
    const poidsEssentiel = 70 / Math.max(essentiels.length, 1);
    essentiels.forEach(k => {
        maxScore += poidsEssentiel;
        if (user.includes(normalize(k))) {
            score += poidsEssentiel;
        }
    });

    // 2️⃣ Concepts secondaires (30%)
    const poidsSecondaire = secondaires.length
        ? 30 / secondaires.length
        : 0;

    secondaires.forEach(k => {
        maxScore += poidsSecondaire;
        if (user.includes(normalize(k))) {
            score += poidsSecondaire;
        }
    });

    // 3️⃣ Détection des erreurs graves (pénalités)
    erreursGraves.forEach(err => {
        const detected = err.detect.every(term =>
            user.includes(normalize(term))
        );
        if (detected) {
            score *= err.penalty;
        }
    });

    // 4️⃣ Sécurité
    score = Math.max(0, Math.min(100, Math.round(score)));

    return score;
}



function highlightDifferences(userText, officialText) {
    const normalizedUser = userText.toLowerCase().split(/\s+/);
    const officialWords = officialText.split(/\s+/);

    return officialWords.map(word => {
        return normalizedUser.includes(word.toLowerCase())
            ? word
            : `<span style="background-color:rgba(255,0,0,0.2);border-radius:3px;padding:0 2px;">${word}</span>`;
    }).join(' ');
}


function playFinishSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5); // A5

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        console.warn("Audio Context failed", e);
    }
}

