/* =========================================================
   책갈피 — 프로토타입 스크립트
   ※ 모든 데이터는 메모리에만 저장됩니다 (새로고침 시 초기화).
   ※ AI 분석(줄거리/인물/주제/감상문/발표자료)은 예시 응답입니다.
     실제 서비스에서는 Electron 메인 프로세스를 통해
     OpenAI API를 호출하고, 결과를 동일한 화면에 출력합니다.
   ========================================================= */

/* ---------------------------------------------------------
   0. 초기 데이터
   --------------------------------------------------------- */

const SPINE_COLORS = ["#2E4B5E", "#6B4A36", "#4A5A3A", "#5C3A4A", "#3A4A56"];

const state = {
  works: [
    {
      id: "w1",
      title: "메밀꽃 필 무렵",
      author: "이효석",
      year: "1936",
      genre: "단편소설",
      memo: "9주차 한국현대소설 수업 발표 예정",
      analysis: { plot: null, characters: null, theme: null }
    },
    {
      id: "w2",
      title: "진달래꽃",
      author: "김소월",
      year: "1925",
      genre: "시",
      memo: "",
      analysis: { plot: null, characters: null, theme: null }
    },
    {
      id: "w3",
      title: "운수 좋은 날",
      author: "현진건",
      year: "1924",
      genre: "단편소설",
      memo: "감상문 과제용",
      analysis: { plot: null, characters: null, theme: null }
    }
  ]
};

let selectedWorkId = null;
let activeAnalysisSection = "plot";
let editingWorkId = null;

/* ---------------------------------------------------------
   1. 공용 유틸
   --------------------------------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function spineColor(workId) {
  const idx = state.works.findIndex(w => w.id === workId);
  return SPINE_COLORS[idx % SPINE_COLORS.length];
}

/* ---------------------------------------------------------
   2. 페이지 내비게이션
   --------------------------------------------------------- */

function showPage(pageId) {
  $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${pageId}`));
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.page === pageId));

  if (pageId === "essay") populateWorkSelect($("#essayWorkSelect"));
  if (pageId === "slides") populateWorkSelect($("#slideWorkSelect"));
}

$$(".tab").forEach(tab => {
  if (tab.disabled) return;
  tab.addEventListener("click", () => showPage(tab.dataset.page));
});

/* ---------------------------------------------------------
   3. 모달 공용
   --------------------------------------------------------- */

function openOverlay(id) { $(`#${id}`).classList.add("open"); }
function closeOverlay(id) { $(`#${id}`).classList.remove("open"); }

$$(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});
$$("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeOverlay(btn.dataset.close));
});

/* ---------------------------------------------------------
   4. 서가 (작품 정보 관리)
   --------------------------------------------------------- */

$("#librarySearch").addEventListener("input", renderShelf);

$("#newWorkBtn").addEventListener("click", () => openWorkModal(null));

function openWorkModal(workId) {
  editingWorkId = workId;
  const work = workId ? state.works.find(w => w.id === workId) : null;

  $("#workModalTitle").textContent = work ? "작품 정보 수정" : "작품 등록";
  $("#workSubmitBtn").textContent = work ? "수정하기" : "등록하기";
  $("#workTitle").value = work?.title ?? "";
  $("#workAuthor").value = work?.author ?? "";
  $("#workYear").value = work?.year ?? "";
  $("#workGenre").value = work?.genre ?? "단편소설";
  $("#workMemo").value = work?.memo ?? "";

  openOverlay("workModal");
}

$("#workForm").addEventListener("submit", e => {
  e.preventDefault();
  const data = {
    title: $("#workTitle").value.trim(),
    author: $("#workAuthor").value.trim(),
    year: $("#workYear").value.trim(),
    genre: $("#workGenre").value,
    memo: $("#workMemo").value.trim()
  };

  if (editingWorkId) {
    const work = state.works.find(w => w.id === editingWorkId);
    Object.assign(work, data);
    toast("작품 정보를 수정했습니다");
    if (selectedWorkId === editingWorkId) renderWorkHead();
  } else {
    state.works.unshift({ id: uid("w"), ...data, analysis: { plot: null, characters: null, theme: null } });
    toast("작품을 등록했습니다");
  }

  closeOverlay("workModal");
  renderShelf();
});

function renderShelf() {
  const query = $("#librarySearch").value.trim().toLowerCase();
  const filtered = state.works.filter(w =>
    w.title.toLowerCase().includes(query) ||
    w.author.toLowerCase().includes(query) ||
    w.genre.toLowerCase().includes(query)
  );

  $("#libraryCount").textContent = `총 ${filtered.length}권`;

  const shelf = $("#shelf");

  if (state.works.length === 0) {
    shelf.innerHTML = `<div class="shelf-empty">아직 등록된 작품이 없습니다. '작품 등록'으로 첫 책을 서가에 꽂아 보세요.</div>`;
    return;
  }

  const spines = filtered.map(w => `
    <div class="spine" style="--spine-color:${spineColor(w.id)}" data-work="${w.id}" title="${escapeHtml(w.title)} 열기">
      <span class="spine__title">${escapeHtml(w.title)}</span>
      <span class="spine__author">${escapeHtml(w.author)}</span>
    </div>
  `).join("");

  shelf.innerHTML = spines + `<button class="add-spine" id="shelfAddBtn" title="작품 등록">＋</button>`;

  $$("[data-work]", shelf).forEach(spine => {
    spine.addEventListener("click", () => openWorkNote(spine.dataset.work));
  });
  $("#shelfAddBtn").addEventListener("click", () => openWorkModal(null));
}

/* ---------------------------------------------------------
5. 작품노트 (줄거리 / 인물 / 주제 분석)
   --------------------------------------------------------- */

function openWorkNote(workId) {
  selectedWorkId = workId;
  activeAnalysisSection = "plot";
  $$(".tab").forEach(t => t.disabled = false);
  showPage("work");
  $(".tab[data-page='work']").addEventListener("click", () => showPage("work"), { once: true });
  renderWorkHead();
  renderAnalysisTabs();
  renderAnalysisBody();
}

function renderWorkHead() {
  const work = state.works.find(w => w.id === selectedWorkId);
  if (!work) return;
  $("#workHead").innerHTML = `
    <div>
      <button class="work-head__back" id="backToShelf">← 서가로 돌아가기</button>
      <h1 class="work-head__title">${escapeHtml(work.title)}</h1>
      <p class="work-head__meta">${escapeHtml(work.author)} · ${escapeHtml(work.year || "출판연도 미기재")} · ${escapeHtml(work.genre)}</p >
      ${work.memo ? `<p class="work-head__memo">${escapeHtml(work.memo)}</p >` : ""}
    </div>
    <div class="work-head__actions">
      <button class="btn btn-ghost" id="editWorkBtn">정보 수정</button>
      <button class="btn btn-danger" id="deleteWorkBtn">삭제</button>
    </div>
  `;
  $("#backToShelf").addEventListener("click", () => showPage("library"));
  $("#editWorkBtn").addEventListener("click", () => openWorkModal(work.id));
  $("#deleteWorkBtn").addEventListener("click", () => {
    if (!confirm(`'${work.title}'을 서가에서 삭제할까요?`)) return;
    state.works = state.works.filter(w => w.id !== work.id);
    toast("작품을 삭제했습니다");
    showPage("library");
    renderShelf();
  });
}

function renderAnalysisTabs() {
  $$(".analysis-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.section === activeAnalysisSection);
    tab.onclick = () => {
      activeAnalysisSection = tab.dataset.section;
      renderAnalysisTabs();
      renderAnalysisBody();
    };
  });
}

function renderAnalysisBody() {
  const work = state.works.find(w => w.id === selectedWorkId);
  if (!work) return;
  const body = $("#analysisBody");
  const section = activeAnalysisSection;
  const data = work.analysis[section];

  const labels = {
    plot: { title: "줄거리 요약", action: "줄거리 생성" },
    characters: { title: "등장인물 정리표", action: "인물 분석 생성" },
    theme: { title: "주제 및 상징 해설", action: "주제 분석 생성" }
  };

  if (!data) {
    body.innerHTML = `
      <div class="analysis-card">
        <div class="analysis-empty">
          <p>아직 ${labels[section].title}이 생성되지 않았습니다.</p >
          <button class="btn btn-primary" id="generateAnalysisBtn">${labels[section].action}</button>
        </div>
      </div>
    `;
    $("#generateAnalysisBtn").addEventListener("click", () => {
      work.analysis[section] = generateAnalysis(work, section);
      renderAnalysisBody();
      toast(`${labels[section].title}이 생성되었습니다`);
    });
    return;
  }

  if (section === "plot") {
    body.innerHTML = `
      <div class="analysis-card">
        <div class="analysis-card__head"><h3>작품 요약본</h3><button class="btn btn-sm btn-ghost" id="regenBtn">다시 생성</button></div>
        <p class="plot-summary">${escapeHtml(data.summary)}</p >
        <ol class="plot-events">
          ${data.events.map((e, i) => `<li><span class="plot-events__num">${String(i + 1).padStart(2, "0")}</span>${escapeHtml(e)}</li>`).join("")}
        </ol>
      </div>
    `;
  } else if (section === "characters") {
    body.innerHTML = `
      <div class="analysis-card">
        <div class="analysis-card__head"><h3>등장인물 정리표</h3><button class="btn btn-sm btn-ghost" id="regenBtn">다시 생성</button></div>
        <div class="character-grid">
          ${data.characters.map(c => `
            <div class="character-card">
              <div class="character-card__name">${escapeHtml(c.name)}</div>
              <span class="character-card__role">${escapeHtml(c.role)}</span>
              <p class="character-card__desc">${escapeHtml(c.desc)}</p >
            </div>
          `).join("")}
        </div>
        <p class="relation-note"><strong>인물 관계</strong> — ${escapeHtml(data.relation)}</p >
      </div>
    `;
  } else if (section === "theme") {
    body.innerHTML = `
      <div class="analysis-card">
        <div class="analysis-card__head"><h3>작품 해설</h3><button class="btn btn-sm btn-ghost" id="regenBtn">다시 생성</button></div>
        <div class="theme-block">
          <p class="theme-block__label">주제</p >
          <p class="theme-block__body">${escapeHtml(data.theme)}</p >
        </div>
        <div class="theme-block">
          <p class="theme-block__label">상징 및 의미</p >
          <ul class="symbol-list">
            ${data.symbols.map(s => `<li><strong>${escapeHtml(s.symbol)}</strong> — ${escapeHtml(s.meaning)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  }

  $("#regenBtn").addEventListener("click", () => {
    work.analysis[section] = generateAnalysis(work, section);
    renderAnalysisBody();
    toast("다시 생성했습니다");
  });
}

/* ---------------------------------------------------------
   6. AI 분석 예시 응답 생성기
   ※ 작품명을 기준으로 그럴듯한 예시 데이터를 만들어 보여줍니다.
   --------------------------------------------------------- */

function generateAnalysis(work, section) {
  if (section === "plot") {
    return {
      summary:
        `『${work.title}』은 ${work.author}의 작품으로, 인물의 여정을 중심으로 사건이 전개됩니다. ` +
        `이야기는 평범한 일상의 한 장면에서 시작되어, 예상치 못한 사건을 계기로 인물들의 관계와 감정이 드러나며, ` +
        `결말에서는 그 여정이 남긴 의미가 독자에게 전달되는 구조를 취하고 있습니다.`,
      events: [
        "이야기의 배경과 주요 인물이 소개된다",
        "일상적인 사건을 계기로 갈등 또는 긴장이 시작된다",
        "사건이 전개되며 인물의 내면과 관계가 드러난다",
        "갈등이 최고조에 이르는 전환점이 등장한다",
        "사건의 결말과 그 의미가 제시되며 이야기가 마무리된다"
      ]
    };
  }

  if (section === "characters") {
    return {
      characters: [
        { name: "주인공", role: "중심 인물", desc: "이야기를 이끌어가는 인물로, 사건을 통해 내면의 변화를 겪습니다." },
        { name: "주변 인물 A", role: "조력자", desc: "주인공과 가까운 관계로, 사건의 전개에 영향을 줍니다." },
        { name: "주변 인물 B", role: "대조 인물", desc: "주인공과 다른 가치관을 보여주며 이야기의 긴장을 만듭니다." }
      ],
      relation:
        "주인공을 중심으로 주변 인물들이 협력 또는 대립하는 관계를 맺으며, 이 관계의 변화가 작품의 핵심 갈등을 구성합니다."
    };
  }

  // theme
  return {
    theme:
      `『${work.title}』은 인간 존재와 관계의 의미를 탐구하는 작품으로 읽을 수 있습니다. ` +
      `표면적인 사건의 이면에는 시대적 배경 속 인물들의 욕망과 좌절, 그리고 그것을 견디는 태도가 담겨 있으며, ` +
      `이는 오늘날의 독자에게도 여전히 유효한 보편적 정서로 다가옵니다.`,
    symbols: [
      { symbol: "공간적 배경", meaning: "인물의 처지와 심리 상태를 비추는 장치로 기능합니다" },
      { symbol: "반복되는 소재", meaning: "작품 전체를 관통하는 정서나 주제를 상징적으로 드러냅니다" },
      { symbol: "결말의 장면", meaning: "사건의 의미를 압축적으로 제시하며 작품의 여운을 남깁니다" }
    ]
  };
}

/* ---------------------------------------------------------
7. 감상문 생성
   --------------------------------------------------------- */

function populateWorkSelect(selectEl) {
  if (state.works.length === 0) {
    selectEl.innerHTML = `<option value="">등록된 작품이 없습니다</option>`;
    return;
  }
  selectEl.innerHTML = state.works.map(w =>
    `<option value="${w.id}">${escapeHtml(w.title)} — ${escapeHtml(w.author)}</option>`
  ).join("");
}

$("#generateEssayBtn").addEventListener("click", () => {
  const workId = $("#essayWorkSelect").value;
  const work = state.works.find(w => w.id === workId);
  const keywordsRaw = $("#essayKeywords").value.trim();

  if (!work) { toast("작품을 먼저 등록해 주세요"); return; }
  if (!keywordsRaw) { toast("감상 키워드를 입력해 주세요"); return; }

  const keywords = keywordsRaw.split(",").map(k => k.trim()).filter(Boolean);
  const essay = generateEssay(work, keywords);

  $("#essayOutput").innerHTML = `
    <span class="manuscript-paper__seal">草稿</span>
    ${escapeHtml(essay)}
  `;
  toast("감상문 초안이 작성되었습니다");
});

function generateEssay(work, keywords) {
  const kw = keywords.length ? keywords : ["여운"];
  const main = kw[0];
  const rest = kw.slice(1);

  let text = `『${work.title}』을 읽고 나서 가장 먼저 떠오른 감정은 '${main}'이었다. ${work.author}의 문장을 따라가다 보면, `;
  text += `인물들이 처한 상황과 그 안에서 느끼는 감정이 결코 먼 과거의 이야기가 아니라는 생각이 들었다.\n\n`;

  if (rest.length) {
    text += `특히 '${rest.join("', '")}' 같은 정서는 작품 곳곳에서 반복적으로 드러나며, 읽는 이로 하여금 자신의 경험을 되돌아보게 만든다. `;
  }
  text += `사건이 전개되는 방식보다도, 인물이 그 사건을 받아들이는 태도에서 작품의 진정한 무게가 느껴졌다.\n\n`;
  text += `이 작품을 통해 나는 '${main}'이라는 감정이 시대와 배경을 넘어 사람들에게 공통적으로 전해지는 정서임을 다시 한번 확인할 수 있었다. `;
  text += `앞으로 비슷한 상황을 마주하게 된다면, 이 작품 속 인물들의 모습을 떠올리며 한 번 더 생각해보게 될 것 같다.\n\n`;
  text += `(이 문단 다음에는 자신만의 구체적인 경험이나 인상적인 장면을 더해 감상문을 완성해 보세요.)`;

  return text;
}

/* ---------------------------------------------------------
   8. 발표 자료 개요 생성
   --------------------------------------------------------- */

$("#generateSlideBtn").addEventListener("click", () => {
  const workId = $("#slideWorkSelect").value;
  const work = state.works.find(w => w.id === workId);
  const topic = $("#slideTopic").value.trim();

  if (!work) { toast("작품을 먼저 등록해 주세요"); return; }
  if (!topic) { toast("발표 주제를 입력해 주세요"); return; }

  const slides = generateSlideOutline(work, topic);

  $("#slideOutput").innerHTML = slides.map((s, i) => `
    <div class="slide-card">
      <p class="slide-card__num">SLIDE ${String(i + 1).padStart(2, "0")}</p >
      <p class="slide-card__title">${escapeHtml(s.title)}</p >
      <ul class="slide-card__points">
        ${s.points.map(p => `<li>${escapeHtml(p)}</li>`).join("")}
      </ul>
    </div>
  `).join("");
  toast("발표 개요가 생성되었습니다");
});

function generateSlideOutline(work, topic) {
  return [
    {
      title: `${work.title} — ${topic}`,
      points: [`발표자 / 발표일`, `${work.author} (${work.year || "출판연도 미기재"})`]
    },
    {
      title: "작품 개관",
      points: [`작품의 배경과 줄거리 한 줄 요약`, `이 발표에서 다룰 주제: ${topic}`]
    },
    {
      title: `${topic} — 핵심 내용 1`,
      points: ["관련 장면 또는 인용 제시", "이 장면이 주제와 연결되는 이유"]
    },
    {
      title: `${topic} — 핵심 내용 2`,
      points: ["대조되는 장면 또는 인물의 반응", "작품 전체 맥락에서의 의미"]
    },
    {
      title: "정리 및 결론",
      points: [`${topic}에 대한 발표자의 해석`, "작품이 오늘날 독자에게 주는 의미"]
    }
  ];
}

/* ---------------------------------------------------------
   9. CSV 내보내기 / 불러오기
   --------------------------------------------------------- */

const CSV_HEADERS = ["작품명", "작가", "출판연도", "장르", "메모"];

function toCsvField(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

$("#exportCsvBtn").addEventListener("click", () => {
  if (state.works.length === 0) {
    toast("내보낼 작품이 없습니다");
    return;
  }
  const rows = [CSV_HEADERS, ...state.works.map(w => [w.title, w.author, w.year, w.genre, w.memo])];
  const csv = rows.map(row => row.map(toCsvField).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "책갈피_작품목록.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("CSV 파일을 내보냈습니다");
});

$("#importCsvInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result.replace(/^\uFEFF/, "");
      const rows = parseCsv(text);
      if (rows.length < 2) {
        toast("불러올 데이터가 없습니다");
        return;
      }
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim() !== ""));
      const imported = dataRows.map(r => ({
        id: uid("w"),
        title: r[0] || "제목 없음",
        author: r[1] || "",
        year: r[2] || "",
        genre: r[3] || "기타",
        memo: r[4] || "",
        analysis: { plot: null, characters: null, theme: null }
      }));
      state.works = [...imported, ...state.works];
      renderShelf();
      toast(`${imported.length}건의 작품을 불러왔습니다`);
    } catch (err) {
      toast("CSV 파일을 읽는 중 오류가 발생했습니다");
    }
    e.target.value = "";
  };
  reader.readAsText(file, "utf-8");
});

// 쉼표/줄바꿈/따옴표를 포함한 간단한 CSV 파서
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (char === "\r") { /* skip */ }
      else { field += char; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ---------------------------------------------------------
   10. 초기화
   --------------------------------------------------------- */
