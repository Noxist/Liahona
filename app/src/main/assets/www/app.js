import { APP_LANGUAGE_SET } from './app-config.js';
import { BOM_DE } from './data/bom-de.js';
import { BOM_EN } from './data/bom-en.js';
import { OT_EN } from './data/ot-en.js';
import { NT_EN } from './data/nt-en.js';

const TRANSLATIONS = {
    de: {
        app_title: "Liahona",
        status_focus: "Fokussieren",
        status_receiving: "Empfange...",
        status_hold: "Länger fokussieren",
        btn_read: "Lesen",
        btn_reset: "Neue Stelle ziehen",
        settings_title: "Einstellungen",
        section_ui: "App Sprache",
        section_content: "Inhalte wählen",
        section_books: "Bücher",
        section_languages: "Sprachen",
        lang_de: "Deutsch",
        lang_en: "Englisch",
        book_bom: "Buch Mormon",
        book_ot: "Altes Testament",
        book_nt: "Neues Testament",
        content_de: "Deutsch",
        content_en: "Englisch",
        btn_save: "Speichern",
    },
    en: {
        app_title: "Liahona",
        status_focus: "Focus",
        status_receiving: "Receiving...",
        status_hold: "Hold longer",
        btn_read: "Read",
        btn_reset: "Pull new verse",
        settings_title: "Settings",
        section_ui: "App Language",
        section_content: "Select Content",
        section_books: "Books",
        section_languages: "Languages",
        lang_de: "German",
        lang_en: "English",
        book_bom: "Book of Mormon",
        book_ot: "Old Testament",
        book_nt: "New Testament",
        content_de: "German",
        content_en: "English",
        btn_save: "Save",
    },
};

const statusMessages = {
    focus: TRANSLATIONS.de.status_focus,
    receiving: TRANSLATIONS.de.status_receiving,
    hold: TRANSLATIONS.de.status_hold,
};

const SETTINGS_KEY = 'liahona_settings_v1';

const defaultSettings = () => ({
    uiLanguage: 'de',
    content: {
        books: {
            bom: true,
            ot: APP_LANGUAGE_SET !== 'DE_ONLY',
            nt: APP_LANGUAGE_SET !== 'DE_ONLY',
        },
        languages: {
            de: APP_LANGUAGE_SET !== 'EN_ONLY',
            en: APP_LANGUAGE_SET !== 'DE_ONLY',
        },
    },
});

const loadSettings = () => {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (!stored) return defaultSettings();
        const parsed = JSON.parse(stored);
        return {
            ...defaultSettings(),
            ...parsed,
            content: {
                ...defaultSettings().content,
                ...(parsed?.content || {}),
                books: { ...defaultSettings().content.books, ...(parsed?.content?.books || {}) },
                languages: { ...defaultSettings().content.languages, ...(parsed?.content?.languages || {}) },
            },
        };
    } catch (err) {
        console.warn('Konnte Einstellungen nicht laden, verwende Standardwerte.', err);
        return defaultSettings();
    }
};

const userSettings = loadSettings();

let DB = [];

const getLanguage = (book) => (BOM_DE.includes(book) ? 'deu' : 'eng');

const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let w = 0;
let h = 0;
let particles = [];
let moveIntensity = 0;

const orb = document.getElementById('orb');
const overlay = document.getElementById('result-overlay');
const status = document.getElementById('status-text');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsToggle = document.getElementById('settings-toggle');
const settingsClose = document.getElementById('settings-close');
const saveSettingsBtn = document.getElementById('btn-save-settings');
const uiLanguageInputs = document.querySelectorAll('input[name="ui-language"]');
const bookCheckboxes = {
    bom: document.getElementById('book-bom'),
    ot: document.getElementById('book-ot'),
    nt: document.getElementById('book-nt'),
};
const languageCheckboxes = {
    de: document.getElementById('lang-de'),
    en: document.getElementById('lang-en'),
};

let start = 0;
let distTotal = 0;
let last = { x: 0, y: 0 };
let selection = null;
let isHolding = false;
let vibrationTimer = null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function initCanvas() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    particles = Array.from({ length: 200 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        s: Math.random() * 2.5 + 0.6,
        v: Math.random() * 0.4 + 0.12,
        alpha: Math.random() * 0.5 + 0.25,
    }));
}

function drawParticles() {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const particleColor = getComputedStyle(document.documentElement).getPropertyValue('--particle-color');

    particles.forEach((p) => {
        if (isHolding) {
            const dx = cx - p.x;
            const dy = cy - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const speed = (8 + moveIntensity * 0.1) * (420 / (distance + 120));
            const normX = dx / (distance || 1);
            const normY = dy / (distance || 1);
            p.x += normX * speed;
            p.y += normY * speed;

            if (distance < 16) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.max(w, h);
                p.x = cx + Math.cos(angle) * radius;
                p.y = cy + Math.sin(angle) * radius;
            }
        } else {
            p.y -= p.v;
            if (p.y < 0) p.y = h;
        }

        ctx.fillStyle = `rgba(${particleColor}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
    });

    moveIntensity *= 0.94;
    requestAnimationFrame(drawParticles);
}

function startVibrationLoop() {
    if (!navigator.vibrate) return;
    stopVibrationLoop();
    vibrationTimer = setInterval(() => navigator.vibrate([6, 10]), 110);
}

function stopVibrationLoop() {
    if (vibrationTimer) {
        clearInterval(vibrationTimer);
        vibrationTimer = null;
    }
}

function onDown(event) {
    if (overlay.classList.contains('show')) return;
    const point = event.touches ? event.touches[0] : event;
    isHolding = true;
    start = performance.now();
    distTotal = 0;
    last = { x: point.clientX, y: point.clientY };
    document.body.classList.add('active-state');
    status.innerText = statusMessages.receiving;
    if (navigator.vibrate) navigator.vibrate(16);
    startVibrationLoop();
}

function onMove(event) {
    if (!isHolding) return;
    const point = event.touches ? event.touches[0] : event;
    const dx = point.clientX - last.x;
    const dy = point.clientY - last.y;
    const moveDist = Math.sqrt(dx * dx + dy * dy);
    distTotal += moveDist;
    moveIntensity = Math.min(moveDist * 2, 90);

    const f = 1;
    const maxOffset = Math.min(w, h) * 0.12;
    let oX = (point.clientX - w / 2) * f;
    let oY = (point.clientY - h / 2) * f;
    oX = clamp(oX, -maxOffset, maxOffset);
    oY = clamp(oY, -maxOffset, maxOffset);
    orb.style.transform = `translate(${oX}px, ${oY}px)`;
    last = { x: point.clientX, y: point.clientY };
}

function onUp() {
    if (!isHolding) return;
    stopVibrationLoop();
    const duration = performance.now() - start;
    isHolding = false;
    document.body.classList.remove('active-state');
    orb.style.transform = 'translate(0, 0)';

    if (duration < 600) {
        status.innerText = statusMessages.hold;
        setTimeout(() => {
            if (!isHolding) status.innerText = statusMessages.focus;
        }, 1800);
        return;
    }

    const seed = Math.floor(duration + distTotal + performance.now());
    const book = DB[seed % DB.length];
    const chapterIndex = (seed * 17) % book.v.length;
    const verseCount = book.v[chapterIndex];
    const verse = (Math.floor(seed / 7) % verseCount) + 1;
    selection = { b: book, c: chapterIndex + 1, v: verse };

    document.getElementById('r-book').innerText = book.n;
    document.getElementById('r-ref').innerText = `${selection.c}:${verse}`;

    setTimeout(() => {
        overlay.classList.add('show');
        if (navigator.vibrate) navigator.vibrate([20, 50, 20, 70]);
    }, 380);
}

function openSelection() {
    if (!selection) return;
    const { b, c, v } = selection;
    const collection = b.collection || 'bofm';
    const lang = getLanguage(b);
    const app = `gospellibrary://content/scriptures/${collection}/${b.s}/${c}?verse=${v}#p${v}`;
    const web = `https://www.churchofjesuschrist.org/study/scriptures/${collection}/${b.s}/${c}.${v}?lang=${lang}#p${v}`;

    const clearListeners = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    const fallback = setTimeout(() => {
        window.open(web, '_blank');
        clearListeners();
    }, 1400);

    const handleVisibilityChange = () => {
        if (document.hidden) {
            clearTimeout(fallback);
            clearListeners();
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange, { once: false });
    window.location.href = app;
}

function resetOverlay() {
    overlay.classList.remove('show');
    status.innerText = statusMessages.focus;
    selection = null;
}

function updateUILanguage() {
    const lang = TRANSLATIONS[userSettings.uiLanguage] ? userSettings.uiLanguage : 'de';
    const dict = TRANSLATIONS[lang];

    document.documentElement.lang = lang;
    document.title = dict.app_title;
    statusMessages.focus = dict.status_focus;
    statusMessages.receiving = dict.status_receiving;
    statusMessages.hold = dict.status_hold;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.dataset.i18n;
        if (dict[key]) el.innerText = dict[key];
    });

    if (!isHolding && !overlay.classList.contains('show')) {
        status.innerText = statusMessages.focus;
    }
}

function rebuildDatabase() {
    const { books, languages } = userSettings.content;
    const dbParts = [];

    if (books.bom) {
        if (languages.de) dbParts.push(...BOM_DE);
        if (languages.en) dbParts.push(...BOM_EN);
    }
    if (books.ot && languages.en) dbParts.push(...OT_EN);
    if (books.nt && languages.en) dbParts.push(...NT_EN);

    if (!dbParts.length) {
        dbParts.push(...BOM_DE);
    }

    DB = dbParts;
}

function populateSettingsControls() {
    uiLanguageInputs.forEach((input) => {
        input.checked = input.value === userSettings.uiLanguage;
    });

    bookCheckboxes.bom.checked = !!userSettings.content.books.bom;
    bookCheckboxes.ot.checked = !!userSettings.content.books.ot;
    bookCheckboxes.nt.checked = !!userSettings.content.books.nt;

    languageCheckboxes.de.checked = !!userSettings.content.languages.de;
    languageCheckboxes.en.checked = !!userSettings.content.languages.en;
}

function saveSettingsToStorage() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
}

function openSettings() {
    populateSettingsControls();
    settingsOverlay.classList.add('open');
}

function closeSettings() {
    settingsOverlay.classList.remove('open');
}

function saveSettings() {
    const selectedLanguage = [...uiLanguageInputs].find((input) => input.checked)?.value || 'de';
    userSettings.uiLanguage = selectedLanguage;

    userSettings.content.books = {
        bom: bookCheckboxes.bom.checked,
        ot: bookCheckboxes.ot.checked,
        nt: bookCheckboxes.nt.checked,
    };

    userSettings.content.languages = {
        de: languageCheckboxes.de.checked,
        en: languageCheckboxes.en.checked,
    };

    saveSettingsToStorage();
    updateUILanguage();
    rebuildDatabase();
    closeSettings();
}

window.addEventListener('resize', initCanvas);
initCanvas();
requestAnimationFrame(drawParticles);

document.addEventListener('contextmenu', (e) => e.preventDefault());

updateUILanguage();
rebuildDatabase();

document.getElementById('btn-reset').addEventListener('click', resetOverlay);
document.getElementById('btn-open').addEventListener('click', openSelection);

orb.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);

settingsToggle.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (event) => {
    if (event.target === settingsOverlay) closeSettings();
});
saveSettingsBtn.addEventListener('click', saveSettings);
