// Backend address. Change this if your FastAPI server runs elsewhere.
const API_BASE = "http://127.0.0.1:8000";

const $ = (id) => document.getElementById(id);

/* ---------- tool switcher ---------- */

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.setAttribute("aria-current", String(t === tab)));
    panels.forEach((p) => { p.hidden = p.id !== tab.dataset.panel; });
  });
});

/* ---------- helpers ---------- */

function show(box, html) {
  box.innerHTML = html;
  box.hidden = false;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// Renders the small Markdown subset Gemini returns:
// headings, bold, bullet lists and numbered lists.
function md(text) {
  const lines = esc(text).split("\n");
  let html = "";
  let list = null; // "ul" or "ol" while inside a list

  const closeList = () => {
    if (list) { html += `</${list}>`; list = null; }
  };

  for (const raw of lines) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    const bullet = line.match(/^\s*[*-]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
    const item = bullet || numbered;

    if (item) {
      const type = bullet ? "ul" : "ol";
      if (list !== type) { closeList(); html += `<${type}>`; list = type; }
      html += `<li>${item[1]}</li>`;
      continue;
    }

    closeList();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) html += `<h4>${h[2]}</h4>`;
    else if (line.trim()) html += `<p>${line}</p>`;
  }

  closeList();
  return html;
}

function errorText(data, res) {
  // FastAPI sends { detail: ... }, custom handlers often send { error: ... }
  const msg = data && (data.error || data.detail);
  if (msg) return typeof msg === "string" ? msg : JSON.stringify(msg);
  return `Server returned status ${res.status}`;
}

async function call(url, options, box, button, render) {
  show(box, '<p class="muted">Working on it…</p>');
  button.disabled = true;
  try {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); } catch (_) { /* not JSON */ }
    if (!res.ok || !data) throw new Error(errorText(data, res));
    show(box, render(data));
    return data;
  } catch (err) {
    // fetch() throws a TypeError when the server is unreachable or CORS blocks it
    const unreachable = err instanceof TypeError;
    const message = unreachable
      ? `Can't reach the server at ${esc(API_BASE)}. Start the FastAPI server and check that CORS is enabled for this page's address.`
      : esc(err.message);
    show(box, `<p class="error">${message}</p>`);
  } finally {
    button.disabled = false;
  }
}

const post = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const submitButton = (formId) => $(formId).querySelector("button[type=submit]");

/* ---------- simple tools ---------- */

$("qaForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("question").value;
  call(`${API_BASE}/qa?question=${encodeURIComponent(q)}`, {}, $("qaResult"), submitButton("qaForm"),
    (d) => `<h3>Answer</h3>${md(d.answer)}`);
});

$("explainForm").addEventListener("submit", (e) => {
  e.preventDefault();
  call(API_BASE + "/explain", post({ topic: $("topic").value }), $("explainResult"), submitButton("explainForm"),
    (d) => `<h3>Explanation</h3>${md(d.explanation)}`);
});

$("summaryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  call(API_BASE + "/summarize", post({ text: $("summaryText").value }), $("summaryResult"), submitButton("summaryForm"),
    (d) => `<h3>Summary</h3>${md(d.summary)}`);
});

$("pathForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const topic = $("pathTopic").value;
  call(`${API_BASE}/learn/recommendations?topic=${encodeURIComponent(topic)}`, {}, $("pathResult"), submitButton("pathForm"),
    (d) => `<h3>Learning path for “${esc(topic)}”</h3>${md(d.recommendation)}`);
});

/* ---------- quiz ---------- */

// The model may return the answer as the option text, or as a letter (A/B/C/D).
function correctIndex(q) {
  const opts = q.options.map((o) => String(o).trim().toLowerCase());
  const ans = String(q.answer).trim().toLowerCase();
  let idx = opts.indexOf(ans);
  if (idx === -1 && /^[a-d]$/.test(ans)) idx = ans.charCodeAt(0) - 97;
  if (idx === -1) idx = opts.findIndex((o) => o.includes(ans) || ans.includes(o));
  return idx;
}

function renderQuiz(box, quiz) {
  box.innerHTML = "<h3>Quiz</h3>";

  quiz.forEach((q, i) => {
    const wrap = document.createElement("div");
    wrap.className = "question";

    const title = document.createElement("p");
    title.innerHTML = `<strong>Q${i + 1}.</strong> `;
    title.append(q.question);
    wrap.appendChild(title);

    q.options.forEach((opt, n) => {
      const label = document.createElement("label");
      label.className = "option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `q${i}`;
      radio.value = String(n);
      label.append(radio, String(opt));
      wrap.appendChild(label);
    });

    const check = document.createElement("button");
    check.type = "button";
    check.className = "btn secondary";
    check.textContent = "Check answer";

    const verdict = document.createElement("p");
    verdict.className = "verdict";
    verdict.setAttribute("aria-live", "polite");

    check.addEventListener("click", () => {
      const picked = wrap.querySelector("input:checked");
      if (!picked) {
        verdict.textContent = "Pick an option first.";
        verdict.className = "verdict muted";
        return;
      }
      const right = correctIndex(q);
      const ok = Number(picked.value) === right;
      verdict.textContent = ok ? "Correct." : `Not quite. Answer: ${right >= 0 ? q.options[right] : q.answer}`;
      verdict.className = "verdict " + (ok ? "good" : "error");
    });

    wrap.append(check, verdict);
    box.appendChild(wrap);
  });
}

$("quizForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const box = $("quizResult");
  const data = await call(API_BASE + "/quiz", post({ text: $("quizText").value }), box, submitButton("quizForm"), () => "");
  if (!data) return;

  const quiz = (data.quiz || []).filter((q) => q && Array.isArray(q.options));
  if (!quiz.length) {
    const err = data.quiz && data.quiz[0] && data.quiz[0].error;
    show(box, `<p class="error">${esc(err || "No quiz came back. Try a more specific topic.")}</p>`);
    return;
  }
  renderQuiz(box, quiz);
});
