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

async function loadStoredData() {
    try {
        console.log("Chargement des questions depuis questions_keywords.json...");

        const response = await fetch('./questions_keywords.json');
        if (!response.ok) throw new Error("JSON introuvable");

        const data = await response.json();

        if (!data.questions || !Array.isArray(data.questions)) {
            throw new Error("Format JSON invalide");
        }

        State.questions = data.questions;

        console.log("Questions chargées :", State.questions.length);
        updateStats();

    } catch (err) {
        console.error("Erreur chargement questions :", err);
        showToast("Impossible de charger les questions");
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
    Object.values(views).forEach(v => {
        if (v) v.classList.remove('active'); // ✅ garde-fou
    });

    if (views[viewName]) {
        views[viewName].classList.add('active');
        State.currentMode = viewName;
    } else {
        console.warn(`Vue inconnue : ${viewName}`);
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
            if (State.questions.length === 0) {
                showToast("Aucune question disponible.");
                return;
            }

            const mode = card.dataset.mode; // ✅ ICI LA CLÉ
            setupSession(mode);
        });
    });



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


// Training Mode Logic
function startTraining(numQuestions = 10) {
    // Tirage aléatoire des questions pour la session training
    State.trainingQuestions = [...State.questions].sort(() => Math.random() - 0.5).slice(0, numQuestions);
    State.currentQuestionIndex = 0;
    State.userAnswers = new Array(State.trainingQuestions.length).fill("");
    navigateTo('training');
    renderTrainingQuestion();
}

function analyzeAnswer(userText, question) {
    const normalize = str =>
        str.toLowerCase()
           .normalize("NFD")
           .replace(/[\u0300-\u036f]/g, "")
           .replace(/\s+/g, " ")
           .trim();

    const user = normalize(userText);

    let motsCles = question.motsCles || [];
    motsCles = motsCles.map(k => normalize(k));

    const found = [];
    const missing = [];

    motsCles.forEach(k => {
        if (user.includes(k)) found.push(k);
        else missing.push(k);
    });

    const pct = motsCles.length ? found.length / motsCles.length : 0;

    let score = 0;
    if (pct <= 0.5) score = Math.round(pct * 70 / 0.5);
    else score = Math.round(70 + (pct - 0.5) * 30 / 0.5);

    return {
        score: Math.min(100, score),
        found,
        missing,
        total: motsCles.length,
        foundCount: found.length
    };
}


function renderTrainingQuestion() {
    const q = State.trainingQuestions[State.currentQuestionIndex];

    // Générer automatiquement mots-clés si nécessaire
    if (!q.motsCles || !q.motsCles.length) {
        let mots = q.reponse
            .split(/[\s,.;:!?]/)
            .map(w => normalizeText(w))
            .filter(Boolean);
        q.motsCles = [...new Set(mots)];
    }

    // Mettre à jour le compteur
    document.getElementById('train-current').textContent = `${State.currentQuestionIndex + 1} / ${State.trainingQuestions.length}`;

    // Afficher la question
    document.getElementById('train-question').innerHTML = formatTextForHTML(q.question);

    // Réinitialiser la zone de réponse
    const answerArea = document.getElementById('train-answer');
    answerArea.value = "";
    answerArea.style.height = 'auto';

    // Réinitialiser feedback et badges précédents
    const feedback = document.getElementById('train-feedback');
    feedback.classList.add('hidden');
    document.getElementById('train-show-answer').classList.remove('hidden');
    document.getElementById('train-next').classList.add('hidden');
    
    document.getElementById('train-official-answer').innerHTML = '';
    document.getElementById('train-keywords').innerHTML = '';
    document.querySelectorAll('.result-badge, .explain-score').forEach(el => el.remove());
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
    const q = State.trainingQuestions[State.currentQuestionIndex];
    const userText = document.getElementById('train-answer').value;

    const analysis = analyzeAnswer(userText, q);

    const feedback = document.getElementById('train-feedback');
    const officialAnswer = document.getElementById('train-official-answer');
    const kwContainer = document.getElementById('train-keywords');

    // Réponse officielle
    officialAnswer.innerHTML = formatTextForHTML(q.reponse);

    // Score
    feedback.classList.remove('good', 'average', 'bad');
    if (analysis.score >= 70) feedback.classList.add('good');
    else if (analysis.score >= 40) feedback.classList.add('average');
    else feedback.classList.add('bad');

    // Badge score
    officialAnswer.insertAdjacentHTML(
        'beforebegin',
        `
        <div class="result-badge">${analysis.score}%</div>
        <div class="explain-score">
            ${analysis.foundCount} mots-clés trouvés sur ${analysis.total}
            → ${Math.round((analysis.foundCount / analysis.total) * 100)}%
            → score final ${analysis.score}%
        </div>
        `
    );

    // Mots-clés
    const foundHTML = analysis.found.map(k =>
        `<span class="keyword-pill good">✔ ${k}</span>`
    ).join('');

    const missingHTML = analysis.missing.map(k =>
        `<span class="keyword-pill bad">✘ ${k}</span>`
    ).join('');

    kwContainer.innerHTML = `
        <div class="kw-section">
            <strong>Trouvés (${analysis.foundCount}/${analysis.total})</strong>
            <div class="kw-list">${foundHTML || "<em>Aucun</em>"}</div>
        </div>
        <div class="kw-section">
            <strong>Manquants</strong>
            <div class="kw-list">${missingHTML || "<em>Aucun</em>"}</div>
        </div>
    `;

    feedback.classList.remove('hidden');
    document.getElementById('train-show-answer').classList.add('hidden');
    document.getElementById('train-next').classList.remove('hidden');
}



function nextTrainingQuestion() {
    State.userAnswers[State.currentQuestionIndex] =
        document.getElementById('train-answer').value;

    State.currentQuestionIndex++;

    if (State.currentQuestionIndex < State.trainingQuestions.length) {
        renderTrainingQuestion();
    } else {
        let totalFound = 0;
        let totalKeywords = 0;

        State.trainingQuestions.forEach((q, idx) => {
            const analysis = analyzeAnswer(State.userAnswers[idx] || "", q);
            totalFound += analysis.foundCount;
            totalKeywords += analysis.total;
        });

        const finalScore = totalKeywords
            ? Math.round((totalFound / totalKeywords) * 100)
            : 0;

        showToast(`Session terminée ! Score final : ${finalScore}%`);
        navigateTo('landing');
    }
}


function calculateFinalScore(questions, userAnswers, seuil = 7) {
    let totalScore = 0;
    questions.forEach((q, idx) => {
        const score = evaluateAnswer(userAnswers[idx] || "", q);
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
    const score = evaluateAnswerStrict(State.userAnswers[idx] || "", q);
    

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
    setTimeout(() => toast.classList.add('hidden'), 5000);
}

function normalizeText(str) {
    return str
        .toLowerCase()
        .normalize("NFD")               // sépare lettres + accents
        .replace(/[\u0300-\u036f]/g, ""); // supprime les accents
}



/**
 * Évalue la réponse de l'utilisateur par rapport aux mots-clés de la réponse officielle
 * @param {string} userText - texte saisi par l'utilisateur
 * @param {object} question - objet question { reponse, motsCles }
 * @returns {number} score en %
 */
function evaluateAnswerStrict(userText, question) {
    if (!userText || !userText.trim()) return 0;
    if (!question.reponse) return 0;

    const normalize = str =>
        str.toLowerCase()
           .normalize("NFD")
           .replace(/[\u0300-\u036f]/g, "")
           .replace(/\s+/g, " ")
           .trim();

    const user = normalize(userText);

    // 1️⃣ générer automatiquement les mots-clés si pas présents
    let motsCles = question.motsCles;
    if (!motsCles || !motsCles.length) {
        motsCles = question.reponse
            .split(/[\s,.;:!?]/)
            .map(w => normalize(w))
            .filter(Boolean);
        // retirer doublons
        motsCles = [...new Set(motsCles)];
    }

    // 2️⃣ compter combien de mots-clés sont présents
    let found = 0;
    motsCles.forEach(k => {
        if (user.includes(k)) found++;
    });

    const pct = found / motsCles.length; // % de mots-clés présents

    // 3️⃣ mapping linéaire 50% -> 70%, 100% -> 100%
    let score = 0;
    if (pct <= 0.5) score = Math.round(pct * 70 / 0.5); // de 0% à 50% → 0 à 70%
    else score = Math.round(70 + (pct - 0.5) * 30 / 0.5); // 50% -> 100%

    return Math.min(100, score);
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

