// Game state
let numbers = []; // Current available numbers (objects with value and id)
let nextId = 0; // For unique button ids
let expression = []; // Current building: [left, op, right]
let history = []; // For undo: array of {used: [obj1, obj2], result: obj}
let score = 0;
let initialNumbers = []; // For reset/hint

// Operators map
const ops = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "×": (a, b) => a * b,
  "÷": (a, b) => (b !== 0 ? a / b : null),
};

// Start the game
function initGame() {
  generateSolvablePuzzle();
  renderNumbers();
  clearExpression();
  history = [];
  updateFeedback("");
}

// Generate four random digits (1-9), ensure solvable
function generateSolvablePuzzle() {
  let attempts = 0;
  while (attempts < 100) {
    const nums = Array.from(
      { length: 4 },
      () => Math.floor(Math.random() * 9) + 1
    );
    if (isSolvable(nums.slice())) {
      initialNumbers = nums.slice();
      numbers = nums.map((n) => ({ value: n, id: nextId++, isResult: false }));
      return;
    }
    attempts++;
  }
  // Fallback to a known solvable
  initialNumbers = [1, 3, 4, 6];
  numbers = initialNumbers.map((n) => ({
    value: n,
    id: nextId++,
    isResult: false,
  }));
}

// Solvability check: Recursive brute-force
function isSolvable(nums) {
  if (nums.length === 1) return Math.abs(nums[0] - 24) < 1e-6;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const remaining = nums.filter((_, idx) => idx !== i && idx !== j);
      for (let op in ops) {
        const result = ops[op](nums[i], nums[j]);
        if (result === null) continue;
        if (isSolvable([...remaining, result])) return true;
      }
    }
  }
  return false;
}

// Render number buttons
function renderNumbers() {
  const area = document.getElementById("numbers-area");
  area.innerHTML = "";
  numbers.forEach((n) => {
    const btn = document.createElement("button");
    btn.className = "number-btn" + (n.isResult ? " result" : "");
    btn.textContent = n.value;
    btn.dataset.id = n.id;
    btn.disabled = false;
    btn.addEventListener("click", handleNumberClick);
    area.appendChild(btn);
  });
}

// Handle number click
function handleNumberClick(e) {
  const id = parseInt(e.target.dataset.id);
  const numObj = numbers.find((n) => n.id === id);
  if (!numObj) return;

  if (expression.length === 0 || expression.length === 2) {
    // Need operand
    expression.push(numObj);
    updateExpressionDisplay();
    disableButton(id);
    if (expression.length === 3) {
      computeExpression();
    }
  } else {
    updateFeedback("Invalid: Expecting operator.");
  }
}

// Handle operator click
function handleOpClick(e) {
  const op = e.target.dataset.op;
  if (expression.length === 1) {
    // After first num
    expression.push(op);
    updateExpressionDisplay();
  } else {
    updateFeedback("Invalid: Expecting number.");
  }
}

// Update expression display
function updateExpressionDisplay() {
  const area = document.getElementById("calculation-area");
  if (expression.length === 0) {
    area.textContent = "";
    return;
  }
  let text = expression[0].value;
  if (expression.length > 1) text += ` ${expression[1]}`;
  if (expression.length > 2)
    text += ` ${expression[2].value} = ${compute(
      expression[0].value,
      expression[1],
      expression[2].value
    )}`;
  area.textContent = text;
}

// Compute the binary operation
function compute(a, op, b) {
  const result = ops[op](a, b);
  if (result === null) return null;
  return Math.abs(result - Math.round(result)) < 1e-6
    ? Math.round(result)
    : result; // Optional: round integers
}

// Perform computation and update state
function computeExpression() {
  const left = expression[0];
  const opStr = expression[1];
  const right = expression[2];
  const res = compute(left.value, opStr, right.value);
  if (res === null) {
    updateFeedback("Error: Division by zero!");
    enableButton(left.id);
    enableButton(right.id);
    clearExpression();
    return;
  }

  const newResult = { value: res, id: nextId++, isResult: true };
  numbers.push(newResult);
  history.push({ used: [left, right], result: newResult });

  // Remove used
  numbers = numbers.filter((n) => n !== left && n !== right);

  clearExpression();
  renderNumbers();
  checkWin();
}

// Clear expression
function clearExpression() {
  expression = [];
  updateExpressionDisplay();
}

// Disable button by id
function disableButton(id) {
  const btn = document.querySelector(`[data-id="${id}"]`);
  if (btn) {
    btn.classList.add("disabled");
    btn.disabled = true;
  }
}

// Enable button by id
function enableButton(id) {
  const btn = document.querySelector(`[data-id="${id}"]`);
  if (btn) {
    btn.classList.remove("disabled");
    btn.disabled = false;
  }
}

// Undo last operation or clear partial expression
function undo() {
  // First, handle partial expression if any
  if (expression.length > 0) {
    // Re-enable disabled buttons in reverse order
    for (let k = expression.length - 1; k >= 0; k--) {
      if (typeof expression[k] !== "string") {
        // It's a numObj
        enableButton(expression[k].id);
      }
    }
    clearExpression();
    updateFeedback("");
    return; // If partial, just clear it without popping history
  }

  // Then, if no partial, undo last completed if history exists
  if (history.length === 0) return;
  const last = history.pop();
  // Remove result
  numbers = numbers.filter((n) => n !== last.result);
  // Add back used
  numbers.push(last.used[0]);
  numbers.push(last.used[1]);
  renderNumbers();
  updateFeedback("");
  clearExpression(); // Ensure clear
}

// Check if won
function checkWin() {
  if (numbers.length === 1) {
    const final = numbers[0].value;
    if (Math.abs(final - 24) < 1e-6) {
      updateFeedback("Incredible!");
      score++;
      updateScore();
      setTimeout(initGame, 2000); // Auto new
    } else {
      updateFeedback("Not 24. Try undo or new puzzle.");
    }
  }
}

// Update feedback
function updateFeedback(msg) {
  document.getElementById("feedback").textContent = msg;
}

// Update score
function updateScore() {
  document.getElementById("score").textContent = `Score: ${score}`;
}

// Hint: Prioritize integer intermediates, avoid negatives, fallback to any solvable positive
function getHint() {
  let allCandidates = [];
  for (let i = 0; i < numbers.length; i++) {
    for (let j = 0; j < numbers.length; j++) {
      if (i === j) continue;
      const a = numbers[i].value;
      const b = numbers[j].value;
      const rem = numbers
        .filter((_, idx) => idx !== i && idx !== j)
        .map((n) => n.value);
      for (let op in ops) {
        const res = ops[op](a, b);
        if (res === null || res < 0) continue; // Skip negatives and invalid
        if (isSolvable([...rem, res])) {
          const isInteger = Math.abs(res - Math.round(res)) < 1e-6;
          const displayRes = isInteger ? Math.round(res) : res;
          allCandidates.push({ a, op, b, res: displayRes, isInteger });
        }
      }
    }
  }
  if (allCandidates.length === 0) {
    updateFeedback("No hint available.");
    return;
  }
  // Prefer integer first
  const integerHints = allCandidates.filter((c) => c.isInteger);
  const hint = integerHints.length > 0 ? integerHints[0] : allCandidates[0];
  updateFeedback(`Hint: Try ${hint.a} ${hint.op} ${hint.b} = ${hint.res}`);
}

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  document
    .querySelectorAll(".op-btn")
    .forEach((btn) => btn.addEventListener("click", handleOpClick));
  document.getElementById("new-puzzle").addEventListener("click", initGame);
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("hint").addEventListener("click", getHint);
  initGame();
});
