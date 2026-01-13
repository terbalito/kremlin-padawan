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
    results: document.getElementById('view-results')
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
            if (mode === 'training') startTraining();
            else navigateTo('examRules');
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
function startTraining() {
    State.currentQuestionIndex = 0;
    navigateTo('training');
    renderTrainingQuestion();
}

function renderTrainingQuestion() {
    const q = State.questions[State.currentQuestionIndex];
    document.getElementById('train-current').textContent = `${State.currentQuestionIndex + 1} / ${State.questions.length}`;
    document.getElementById('train-question').textContent = q.question;
    const answerArea = document.getElementById('train-answer');
    answerArea.value = "";
    answerArea.style.height = 'auto';
    
    document.getElementById('train-feedback').classList.add('hidden');
    document.getElementById('train-show-answer').classList.remove('hidden');
    document.getElementById('train-next').classList.add('hidden');
}

function showTrainingFeedback() {
    const q = State.questions[State.currentQuestionIndex];
    const feedback = document.getElementById('train-feedback');
    const officialAnswer = document.getElementById('train-official-answer');
    const kwContainer = document.getElementById('train-keywords');

    const userText = document.getElementById('train-answer').value;
    const score = evaluateAnswer(userText, q.motsCles);

    officialAnswer.textContent = q.reponse;

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
    State.currentQuestionIndex++;
    if (State.currentQuestionIndex < State.questions.length) {
        renderTrainingQuestion();
    } else {
        showToast("Bravo ! Vous avez terminé toutes les questions.");
        navigateTo('landing');
    }
}

// Exam Mode Logic
function startExam() {
    // Select 10 random questions
    State.examQuestions = [...State.questions]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
    
    State.userAnswers = new Array(State.examQuestions.length).fill("");
    State.currentQuestionIndex = 0;
    State.examTimeRemaining = 3600; // 60 mins

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
    document.getElementById('exam-question-text').textContent = q.question;
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

    // Calcul des scores
    let bonnes = 0, moyennes = 0, mauvaises = 0;
    let totalScore = 0;

    const scores = State.examQuestions.map((q, idx) => {
        const userAns = State.userAnswers[idx];
        const score = evaluateAnswer(userAns, q.motsCles);
        totalScore += score;

        if (score >= 70) bonnes++;
        else if (score >= 40) moyennes++;
        else mauvaises++;

        return score;
    });

    const pourcentageTotal = Math.round(totalScore / State.examQuestions.length);

    // Affichage résumé général
    const summaryHTML = `
        <div class="history-summary centered" style="margin-bottom:2rem;">
            <h2>Récapitulatif de l'examen</h2>
            <div class="history-item good">
                <strong>${bonnes} / ${State.examQuestions.length}</strong>
                <small>Bonnes réponses (≥70%)</small>
            </div>
            <div class="history-item average">
                <strong>${moyennes} / ${State.examQuestions.length}</strong>
                <small>Réponses moyennes (40–69%)</small>
            </div>
            <div class="history-item bad">
                <strong>${mauvaises} / ${State.examQuestions.length}</strong>
                <small>Mauvaises réponses (<40%)</small>
            </div>
            <div class="history-item" style="background:var(--accent);color:white;">
                <strong>${pourcentageTotal}%</strong>
                <small>Score total</small>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', summaryHTML);

    // Affichage détaillé question par question
    State.examQuestions.forEach((q, idx) => {
        const userAns = State.userAnswers[idx];
        const score = scores[idx];
        const scoreClass =
            score >= 70 ? 'good' :
            score >= 40 ? 'average' : 'bad';

        const item = document.createElement('div');
        item.className = `result-item ${scoreClass}`;

        item.innerHTML = `
            <div class="result-header">
                <div>
                    <strong>Question ${idx + 1}</strong>
                    <span class="result-badge ${scoreClass}">${score}%</span>
                    <p>${q.question}</p>
                </div>
                <span>▼</span>
            </div>
            <div class="result-details">
                <div class="answer-comparison">
                    <div class="answer-box">
                        <h5>Votre réponse</h5>
                        <p>${userAns || "<em>Aucune réponse fournie</em>"}</p>
                    </div>
                    <div class="answer-box">
                        <h5>Réponse officielle</h5>
                        <p>${highlightDifferences(userAns, q.reponse)}</p>
                        <div class="keywords-container" style="margin-top:1rem;">
                            ${q.motsCles.map(k => `<span class="keyword-pill">${k}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Toggle détail
        item.querySelector('.result-header').addEventListener('click', () => {
            const details = item.querySelector('.result-details');
            details.classList.toggle('active');
            item.querySelector('span').textContent =
                details.classList.contains('active') ? '▲' : '▼';
        });

        container.appendChild(item);
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



function evaluateAnswer(userText, keywords = []) {
    if (!userText || keywords.length === 0) return 0;

    const normalizedAnswer = normalizeText(userText);
    let hits = 0;

    keywords.forEach(k => {
        const normalizedKeyword = normalizeText(k);
        if (normalizedAnswer.includes(normalizedKeyword)) {
            hits++;
        }
    });

    return Math.round((hits / keywords.length) * 100);
}
function calculerScore(reponseUtilisateur, keywords) {
  const texte = reponseUtilisateur.toLowerCase();
  let matches = 0;

  keywords.forEach(mot => {
    if (texte.includes(mot.toLowerCase())) {
      matches++;
    }
  });

  return matches / keywords.length;
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