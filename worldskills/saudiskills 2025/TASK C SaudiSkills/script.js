document.addEventListener("DOMContentLoaded", () => {
    const startQuizButton = document.getElementById("start-quiz");
    const uploadQuestionsInput = document.getElementById("upload-questions");
    const settingsButton = document.getElementById("settings");
    const mainMenu = document.getElementById("main-menu");
    const quizInterface = document.getElementById("quiz-interface");
    const quizResult = document.getElementById("quiz-result");
    const questionArea = document.getElementById("question-area");
    const answerOptions = document.getElementById("answer-options");
    const nextButton = document.getElementById("next-question");
    const prevButton = document.getElementById("prev-question");
    const questionCounter = document.getElementById("question-counter");
    const timerDisplay = document.getElementById("timer");
    const scoreDisplay = document.getElementById("score-display");
    const finalScoreDisplay = document.getElementById("final-score");
    const restartQuizButton = document.getElementById("restart-quiz");

    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let timer = null;

    function loadQuestions(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                questions = JSON.parse(e.target.result).questions;
                if (validateQuestions(questions)) {
                    alert("Questions loaded successfully!");
                } else {
                    alert("Invalid JSON format.");
                }
            } catch (error) {
                alert("Failed to parse JSON.");
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function validateQuestions(questions) {
        return questions.every(
            (q) =>
                q.id !== undefined &&
                q.question &&
                q.type &&
                (q.type === "multiple" ? q.options.length > 1 : true) &&
                q.correctAnswer !== undefined
        );
    }

    function startQuiz() {
        if (questions.length === 0) {
            alert("Please upload a valid set of questions first!");
            return;
        }

        mainMenu.classList.add("hidden");
        quizResult.classList.add("hidden");
        quizInterface.classList.remove("hidden");

        currentQuestionIndex = 0;
        score = 0;

        displayQuestion();
        if (timer) clearInterval(timer);
        startTimer();
    }

    function displayQuestion() {
        const question = questions[currentQuestionIndex];
        questionArea.textContent = question.question;
        answerOptions.innerHTML = "";

        if (question.type === "multiple") {
            question.options.forEach((option, index) => {
                const btn = document.createElement("button");
                btn.textContent = option;
                btn.addEventListener("click", () => checkAnswer(index));
                answerOptions.appendChild(btn);
            });
        } else if (question.type === "truefalse") {
            ["True", "False"].forEach((option, index) => {
                const btn = document.createElement("button");
                btn.textContent = option;
                btn.addEventListener("click", () => checkAnswer(index));
                answerOptions.appendChild(btn);
            });
        } else if (question.type === "text") {
            const input = document.createElement("input");
            input.type = "text";
            input.id = "text-answer";
            input.placeholder = "Type your answer here";
            answerOptions.appendChild(input);

            const submitBtn = document.createElement("button");
            submitBtn.textContent = "Submit";
            submitBtn.addEventListener("click", () => {
                const userAnswer = document.getElementById("text-answer").value.trim();
                checkAnswer(userAnswer);
            });
            answerOptions.appendChild(submitBtn);
        }
        updateQuizStatus();
    }

    function checkAnswer(selected) {
        const question = questions[currentQuestionIndex];
        if (question.type === "text") {
            if (selected.toLowerCase() === question.correctAnswer.toLowerCase()) {
                score++;
            }
        } else if (
            (question.type === "multiple" && selected === question.correctAnswer) ||
            (question.type === "truefalse" &&
                ((selected === 0 && question.correctAnswer === true) ||
                    (selected === 1 && question.correctAnswer === false)))
        ) {
            score++;
        }
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        } else {
            endQuiz();
        }
    }

    function startTimer() {
        let timeRemaining = 60;
        timerDisplay.textContent = `Time: ${timeRemaining}s`;
        timer = setInterval(() => {
            timeRemaining--;
            timerDisplay.textContent = `Time: ${timeRemaining}s`;
            if (timeRemaining <= 0) {
                clearInterval(timer);
                endQuiz();
            }
        }, 1000);
    }

    function endQuiz() {
        clearInterval(timer);
        quizInterface.classList.add("hidden");
        quizResult.classList.remove("hidden");
        finalScoreDisplay.textContent = `Your final score is ${score} out of ${questions.length}.`;
    }

    function updateQuizStatus() {
        questionCounter.textContent = `Question ${currentQuestionIndex + 1} / ${
            questions.length
        }`;
        scoreDisplay.textContent = `Score: ${score}`;
    }

    startQuizButton.addEventListener("click", () => {
        if (questions.length === 0) {
            alert("Please upload questions first!");
        } else {
            startQuiz();
        }
    });

    uploadQuestionsInput.addEventListener("change", (event) => {
        if (event.target.files[0]) {
            loadQuestions(event.target.files[0]);
        }
    });

    settingsButton.addEventListener("click", () => {
        alert("Settings feature coming soon!");
    });

    restartQuizButton.addEventListener("click", () => {
        quizResult.classList.add("hidden");
        quizInterface.classList.add("hidden");
        mainMenu.classList.remove("hidden");
        questions = [];
        currentQuestionIndex = 0;
        score = 0;
    });
});
