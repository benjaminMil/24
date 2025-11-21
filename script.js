// Configuration
const TARGET = 24;
const EPSILON = 1e-6;

// Operations: specific checks for "Clean" math
const OPS = {
  "+": { calc: (a, b) => a + b, symbol: "+" },
  "-": { calc: (a, b) => a - b, symbol: "-" },
  "×": { calc: (a, b) => a * b, symbol: "×" },
  "÷": { calc: (a, b) => a / b, symbol: "÷" },
};

// Game State
const state = {
  score: 0,
  numbers: [],
  expression: [],
  history: [],
  nextId: 0,
  isProcessing: false, // Prevents clicks during 1s delay
};

// --- Initialization ---

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  startNewGame();
});

function setupEventListeners() {
  // Game Interactions
  document
    .getElementById("numbers-area")
    .addEventListener("click", handleNumberClick);
  document
    .getElementById("operations-area")
    .addEventListener("click", handleOpClick);

  document.getElementById("new-puzzle").addEventListener("click", startNewGame);
  document.getElementById("undo").addEventListener("click", handleUndo);
  document.getElementById("hint").addEventListener("click", showHint);

  // --- Modal Logic (Rules) ---
  const modal = document.getElementById("rules-modal");
  const rulesBtn = document.getElementById("rules-btn");
  const closeBtn = document.getElementById("close-modal");

  // Helper to close modal and return focus
  const closeModal = () => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    rulesBtn.focus(); // <--- THIS FIXES THE ARIA ERROR
  };

  // Open Modal
  rulesBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    closeBtn.focus(); // Optional: Move focus into the modal when opening
  });

  // Close Modal (Button)
  closeBtn.addEventListener("click", closeModal);

  // Close Modal (Click Outside)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close Modal (Escape Key)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
}

// --- Core Game Logic ---

function startNewGame() {
  state.numbers = [];
  state.expression = [];
  state.history = [];
  state.nextId = 0;
  state.isProcessing = false;

  updateFeedback("");
  clearExpressionDisplay();
  setOperatorButtonsDisabled(false);

  let attempts = 0;
  while (attempts < 100) {
    const nums = Array.from(
      { length: 4 },
      () => Math.floor(Math.random() * 9) + 1
    );

    if (findSolution(nums)) {
      state.numbers = nums.map((n) => createNumberObj(n));
      renderNumbers();
      return;
    }
    attempts++;
  }

  // Fallback safe puzzle
  state.numbers = [3, 3, 8, 8].map((n) => createNumberObj(n));
  renderNumbers();
}

function createNumberObj(value, isResult = false) {
  return { value, id: state.nextId++, isResult };
}

// --- Interaction Handlers ---

function handleNumberClick(e) {
  if (state.isProcessing) return;

  const btn = e.target.closest(".number-btn");
  if (!btn || btn.classList.contains("disabled")) return;

  const id = parseInt(btn.dataset.id);
  const numObj = state.numbers.find((n) => n.id === id);

  // Logic: Expecting 1st or 3rd item in expression
  if (state.expression.length === 0 || state.expression.length === 2) {
    state.expression.push(numObj);
    disableButtonInDOM(id);
    updateExpressionDisplay();

    // If complete (Num Op Num), calculate
    if (state.expression.length === 3) {
      performCalculation();
    }
  } else {
    updateFeedback("Select an operator next.");
  }
}

function handleOpClick(e) {
  if (state.isProcessing) return;

  const btn = e.target.closest(".op-btn");
  if (!btn || btn.disabled) return;

  const op = btn.dataset.op;

  // Logic: Expecting 2nd item (operator)
  if (state.expression.length === 1) {
    state.expression.push(op);
    updateExpressionDisplay();
    setOperatorButtonsDisabled(true);
  } else {
    updateFeedback("Select a number first.");
  }
}

function performCalculation() {
  const [leftObj, op, rightObj] = state.expression;
  const resultVal = OPS[op].calc(leftObj.value, rightObj.value);

  // Error handling (division by zero)
  if (resultVal === null) {
    updateFeedback("Cannot divide by zero!");
    resetExpressionButtons();
    return;
  }

  // Lock interface
  state.isProcessing = true;

  // Show full equation immediately
  const displayRes = formatResult(resultVal);
  const area = document.getElementById("calculation-area");
  area.textContent = `${leftObj.value} ${op} ${rightObj.value} = ${displayRes}`;

  // 1 second delay before updating state/UI
  setTimeout(() => {
    const newNum = createNumberObj(displayRes, true);

    // Save history
    state.history.push({
      removed: [leftObj, rightObj],
      added: newNum,
    });

    // Update numbers array
    state.numbers = state.numbers.filter(
      (n) => n.id !== leftObj.id && n.id !== rightObj.id
    );
    state.numbers.push(newNum);

    // Reset UI & Unlock
    state.expression = [];
    state.isProcessing = false;

    clearExpressionDisplay();
    renderNumbers();
    setOperatorButtonsDisabled(false);
    checkWinCondition();
  }, 1000);
}

function handleUndo() {
  if (state.isProcessing) return;

  // 1. If partial expression exists, just clear that
  if (state.expression.length > 0) {
    resetExpressionButtons();
    return;
  }

  // 2. If no expression, undo last math move
  if (state.history.length === 0) return;

  const lastMove = state.history.pop();

  // Remove the result number
  state.numbers = state.numbers.filter((n) => n.id !== lastMove.added.id);

  // Add back the original numbers
  state.numbers.push(...lastMove.removed);

  renderNumbers();
  updateFeedback("");
  setOperatorButtonsDisabled(false);
}

// --- Solver (Strict Integers Only) ---
function findSolution(currentNums) {
  if (currentNums.length === 1) {
    return Math.abs(currentNums[0] - TARGET) < EPSILON ? true : null;
  }

  for (let i = 0; i < currentNums.length; i++) {
    for (let j = 0; j < currentNums.length; j++) {
      if (i === j) continue;

      const a = currentNums[i];
      const b = currentNums[j];
      const remaining = currentNums.filter((_, idx) => idx !== i && idx !== j);

      for (const opKey in OPS) {
        const op = OPS[opKey];
        // Commutative Optimization
        if ((opKey === "+" || opKey === "×") && a < b) continue;
        // No Negatives
        if (opKey === "-" && a < b) continue;
        // No Fractions
        if (opKey === "÷") {
          if (b === 0 || a % b !== 0) continue;
        }

        const res = op.calc(a, b);
        if (findSolution([...remaining, res])) {
          return { a, op: opKey, b, res };
        }
      }
    }
  }
  return null;
}

function showHint() {
  if (state.isProcessing) return;

  const values = state.numbers.map((n) => n.value);
  const step = findSolution(values);

  if (step && typeof step === "object") {
    const displayRes = formatResult(step.res);
    updateFeedback(`Hint: Try ${step.a} ${step.op} ${step.b} = ${displayRes}`);
  } else {
    updateFeedback("Hint: Press Undo");
  }
}

// --- Rendering & Helpers ---

function renderNumbers() {
  const area = document.getElementById("numbers-area");
  area.innerHTML = "";

  state.numbers.forEach((num) => {
    const btn = document.createElement("button");
    btn.className = `number-btn ${num.isResult ? "result" : ""}`;
    btn.textContent = num.value;
    btn.dataset.id = num.id;
    area.appendChild(btn);
  });
}

function updateExpressionDisplay() {
  const area = document.getElementById("calculation-area");
  if (state.expression.length === 0) {
    area.textContent = "";
    return;
  }

  const [left, op] = state.expression;
  let text = `${left.value}`;

  if (op) text += ` ${op}`;
  area.textContent = text;
}

function clearExpressionDisplay() {
  document.getElementById("calculation-area").textContent = "";
  updateFeedback("");
}

function resetExpressionButtons() {
  state.expression.forEach((item) => {
    if (typeof item === "object") enableButtonInDOM(item.id);
  });
  state.expression = [];
  clearExpressionDisplay();
  updateFeedback("");
  setOperatorButtonsDisabled(false);
}

function setOperatorButtonsDisabled(isDisabled) {
  const opButtons = document.querySelectorAll(".op-btn");
  opButtons.forEach((btn) => {
    btn.disabled = isDisabled;
    if (isDisabled) btn.classList.add("disabled");
    else btn.classList.remove("disabled");
  });
}

function disableButtonInDOM(id) {
  const btn = document.querySelector(`.number-btn[data-id="${id}"]`);
  if (btn) {
    btn.classList.add("disabled");
    btn.disabled = true;
  }
}

function enableButtonInDOM(id) {
  const btn = document.querySelector(`.number-btn[data-id="${id}"]`);
  if (btn) {
    btn.classList.remove("disabled");
    btn.disabled = false;
  }
}

function checkWinCondition() {
  if (state.numbers.length === 1) {
    const val = state.numbers[0].value;
    if (Math.abs(val - TARGET) < EPSILON) {
      updateFeedback("Incredible! You made 24!");
      state.score++;
      document.getElementById("score").textContent = `Solved: ${state.score}`;
      setTimeout(startNewGame, 2500);
    } else {
      updateFeedback(`Unlucky, not 24. Undo or try New Puzzle.`);
    }
  }
}

function formatResult(num) {
  return Math.abs(num - Math.round(num)) < EPSILON
    ? Math.round(num)
    : parseFloat(num.toFixed(2));
}

function updateFeedback(msg) {
  document.getElementById("feedback").textContent = msg;
}
