let allQuizData = [];
let daySessions = [];       // Array menampung 8 sesi (tiap sesi ~7-8 soal)
let currentSessionIdx = 0;  // Indeks sesi saat ini
let currentSessionQuestions = [];
let currentQuestionIndex = 0;
let correctCount = 0;
let questionStartTime = 0;

// User Stats (EXP & Level)
let userExp = parseInt(localStorage.getItem('user_exp')) || 0;
let userLevel = parseInt(localStorage.getItem('user_level')) || 1;

document.addEventListener("DOMContentLoaded", () => {
    updateUserStatsDisplay();
    
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            allQuizData = data;
            populateQuizDayDropdown();
        })
        .catch(error => {
            console.error("Error loading data.json for quiz:", error);
        });
});

// --- SISTEM UNLOCK HARIAN (MULAI TANGGAL 5) ---
function getMaxUnlockedDay() {
    const now = new Date();
    const dateNum = now.getDate();
    if (dateNum < 5) return 1;
    return dateNum - 4;
}

function populateQuizDayDropdown() {
    const selectElement = document.getElementById('quizDaySelect');
    if (!selectElement) return;
    selectElement.innerHTML = '';
    
    const maxUnlocked = getMaxUnlockedDay();
    const days = [...new Set(allQuizData.map(item => item.day))].sort((a, b) => a - b);
    
    if (days.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = "Tidak ada data hari tersedia";
        selectElement.appendChild(opt);
        return;
    }

    days.forEach(dayNum => {
        const count = allQuizData.filter(i => i.day === dayNum).length;
        const opt = document.createElement('option');
        opt.value = dayNum;
        
        if (dayNum <= maxUnlocked) {
            opt.textContent = `Hari ke-${dayNum} (${count} Kosakata)`;
        } else {
            opt.textContent = `🔒 Hari ke-${dayNum} (Terkunci)`;
            opt.disabled = true;
        }
        selectElement.appendChild(opt);
    });
}

function startQuiz() {
    const selectElement = document.getElementById('quizDaySelect');
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const selectedDay = parseInt(selectElement.value);
    
    if (selectedOption.disabled || selectedDay > getMaxUnlockedDay()) {
        alert("🔒 Quiz untuk hari ini masih terkunci!");
        return;
    }

    const dayData = allQuizData.filter(item => item.day === selectedDay);
    if (dayData.length === 0) {
        alert("Kosakata untuk hari ini tidak ditemukan!");
        return;
    }

    // Bagi kosakata menjadi 8 sesi secara merata dan diacak
    daySessions = [];
    let shuffledDayData = shuffleArray([...dayData]);
    const chunkSize = Math.ceil(shuffledDayData.length / 8);
    
    for (let i = 0; i < shuffledDayData.length; i += chunkSize) {
        daySessions.push(shuffledDayData.slice(i, i + chunkSize));
    }

    currentSessionIdx = 0;
    correctCount = 0;

    document.getElementById('quizSelectionCard').style.display = 'none';
    document.getElementById('quizBreakScreen').style.display = 'none';
    document.getElementById('quizArea').style.display = 'block';
    document.getElementById('quizCompletionScreen').style.display = 'none';

    loadCurrentSession();
}

function loadCurrentSession() {
    if (currentSessionIdx >= daySessions.length) {
        finishQuizCompletion();
        return;
    }
    // Ambil soal sesi saat ini dan acak
    currentSessionQuestions = shuffleArray([...daySessions[currentSessionIdx]]);
    currentQuestionIndex = 0;
    loadQuizQuestion();
}

function loadQuizQuestion() {
    if (currentQuestionIndex >= currentSessionQuestions.length) {
        // Sesi ini selesai, panggil layar rehat/jeda sebelum lanjut sesi berikutnya
        triggerSessionBreak();
        return;
    }

    const currentQuestion = currentSessionQuestions[currentQuestionIndex];
    
    document.getElementById('quizQuestionText').textContent = currentQuestion.front;
    document.getElementById('quizCounter').textContent = `Sesi ${currentSessionIdx + 1}/${daySessions.length} | Soal: ${currentQuestionIndex + 1}/${currentSessionQuestions.length}`;
    document.getElementById('quizScore').textContent = `Benar: ${correctCount}`;

    questionStartTime = Date.now();

    const optionsContainer = document.getElementById('quizOptions');
    optionsContainer.innerHTML = '';

    const wrongChoices = allQuizData
        .filter(item => item.back !== currentQuestion.back)
        .map(item => item.back);
    
    const shuffledWrong = shuffleArray(wrongChoices).slice(0, 3);
    const choices = shuffleArray([currentQuestion.back, ...shuffledWrong]);

    choices.forEach(choiceText => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option-btn';
        btn.textContent = choiceText;
        btn.onclick = () => selectQuizAnswer(btn, choiceText, currentQuestion.back);
        optionsContainer.appendChild(btn);
    });
}

function selectQuizAnswer(buttonElement, selectedAnswer, correctAnswer) {
    const allButtons = document.querySelectorAll('.quiz-option-btn');
    allButtons.forEach(btn => btn.disabled = true);

    const answerDuration = (Date.now() - questionStartTime) / 1000;

    if (selectedAnswer === correctAnswer) {
        buttonElement.classList.add('correct');
        correctCount++;

        // Sistem EXP berdasarkan kecepatan jawab
        if (answerDuration <= 2) {
            addExp(10); // 0-2 detik: +10 EXP
        } else if (answerDuration <= 5) {
            addExp(5);  // 2-5 detik: +5 EXP
        } else {
            addExp(2);  // 6-20 detik: +2 EXP
        }
    } else {
        buttonElement.classList.add('wrong');
        allButtons.forEach(btn => {
            if (btn.textContent === correctAnswer) {
                btn.classList.add('correct');
            }
        });
    }

    // Jeda 1.2 detik sebelum lanjut ke soal berikutnya dalam sesi ini
    setTimeout(() => {
        currentQuestionIndex++;
        loadQuizQuestion();
    }, 1200);
}

function triggerSessionBreak() {
    document.getElementById('quizArea').style.display = 'none';
    
    const breakTextEl = document.getElementById('breakText');
    if (currentSessionIdx < daySessions.length - 1) {
        breakTextEl.innerHTML = `☕ Sesi ${currentSessionIdx + 1} Selesai!<br>Ambil napas sejenak sebelum lanjut ke Sesi ${currentSessionIdx + 2}.`;
    } else {
        breakTextEl.innerHTML = `☕ Sesi terakhir selesai!<br>Siap-siap melihat hasil akhir kuis hari ini.`;
    }
    
    document.getElementById('quizBreakScreen').style.display = 'block';
}

function resumeQuizAfterBreak() {
    document.getElementById('quizBreakScreen').style.display = 'none';
    currentSessionIdx++;
    
    if (currentSessionIdx >= daySessions.length) {
        finishQuizCompletion();
    } else {
        document.getElementById('quizArea').style.display = 'block';
        loadCurrentSession();
    }
}

function finishQuizCompletion() {
    document.getElementById('quizArea').style.display = 'none';
    document.getElementById('quizBreakScreen').style.display = 'none';
    document.getElementById('quizCompletionScreen').style.display = 'block';
    
    const totalQuestions = daySessions.reduce((acc, session) => acc + session.length, 0);
    document.getElementById('quizResultText').innerHTML = `
        🎉 Kuis Selesai!<br>
        Jawaban Benar: <b>${correctCount} / ${totalQuestions}</b><br>
        Semua sesi hari ini telah berhasil diselesaikan!
    `;
}

function exitQuiz() {
    document.getElementById('quizArea').style.display = 'none';
    document.getElementById('quizBreakScreen').style.display = 'none';
    document.getElementById('quizSelectionCard').style.display = 'block';
}

function backToQuizSelection() {
    document.getElementById('quizCompletionScreen').style.display = 'none';
    document.getElementById('quizSelectionCard').style.display = 'block';
    populateQuizDayDropdown();
}

// --- EXP & LEVEL SYSTEM ---
function addExp(amount) {
    userExp += amount;
    let nextLevelExp = userLevel * 100;

    if (userExp >= nextLevelExp) {
        userExp -= nextLevelExp;
        userLevel++;
        alert(`🎉 SELAMAT! Kamu naik ke Level ${userLevel}!`);
    }

    localStorage.setItem('user_exp', userExp);
    localStorage.setItem('user_level', userLevel);
    updateUserStatsDisplay();
}

function updateUserStatsDisplay() {
    const levelEl = document.getElementById('userLevel');
    const expEl = document.getElementById('userExp');
    const nextExpEl = document.getElementById('nextLevelExp');

    if (levelEl) levelEl.textContent = userLevel;
    if (expEl) expEl.textContent = userExp;
    if (nextExpEl) nextExpEl.textContent = userLevel * 100;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}