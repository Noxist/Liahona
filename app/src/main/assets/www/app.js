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
        content_books: "Bücher",
        content_languages: "Sprachen",
        book_bom: "Buch Mormon",
        book_ot: "Altes Testament",
        book_nt: "Neues Testament",
        lang_de: "Deutsch",
        lang_en: "Englisch",
        btn_save: "Speichern",
        btn_close: "Schließen",
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
        content_books: "Books",
        content_languages: "Languages",
        book_bom: "Book of Mormon",
        book_ot: "Old Testament",
        book_nt: "New Testament",
        lang_de: "German",
        lang_en: "English",
        btn_save: "Save",
        btn_close: "Close",
    },
};

const SETTINGS_KEY = 'liahonaSettings';

const getDefaultContent = () => {
    switch (APP_LANGUAGE_SET) {
        case 'DE_ONLY':
            return {
                books: { bom: true, ot: false, nt: false },
                languages: { de: true, en: false },
            };
        case 'EN_ONLY':
            return {
                books: { bom: true, ot: true, nt: true },
                languages: { de: false, en: true },
            };
        case 'ALL':
        default:
            return {
                books: { bom: true, ot: true, nt: true },
                languages: { de: true, en: true },
            };
    }
};

const loadSettings = () => {
    const defaults = {
        uiLanguage: 'de',
        content: getDefaultContent(),
    };

    try {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        return {
            uiLanguage: stored.uiLanguage || defaults.uiLanguage,
            content: {
                books: { ...defaults.content.books, ...(stored.content?.books || {}) },
                languages: { ...defaults.content.languages, ...(stored.content?.languages || {}) },
            },
        };
    } catch (error) {
        console.warn('Konnte gespeicherte Einstellungen nicht laden, nutze Standardwerte.', error);
        return defaults;
    }
};

let userSettings = loadSettings();
let DB = [];

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
const settingsBtn = document.getElementById('settings-btn');
const settingsClose = document.getElementById('settings-close');
const settingsSave = document.getElementById('settings-save');
const uiLanguageInputs = document.querySelectorAll('input[name="ui-language"]');
const bookBOM = document.getElementById('book-bom');
const bookOT = document.getElementById('book-ot');
const bookNT = document.getElementById('book-nt');
const langDE = document.getElementById('lang-de');
const langEN = document.getElementById('lang-en');

let statusFocusText = '';
let statusReceivingText = '';
let statusHoldText = '';

let start = 0;
let distTotal = 0;
let last = { x: 0, y: 0 };
let selection = null;
let isHolding = false;
let vibrationTimer = null;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const persistSettings = () => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
    } catch (error) {
        console.warn('Konnte Einstellungen nicht speichern.', error);
    }
};

function rebuildDatabase() {
    DB = [];
    const { books, languages } = userSettings.content;

    if (books.bom && languages.de) DB.push(...BOM_DE);
    if (books.bom && languages.en) DB.push(...BOM_EN);
    if (books.ot && languages.en) DB.push(...OT_EN);
    if (books.nt && languages.en) DB.push(...NT_EN);

    if (DB.length === 0) {
        DB = [...BOM_DE];
    }
}

const getLanguage = (book) => (BOM_DE.includes(book) ? 'deu' : 'eng');

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

function updateUILanguage() {
    const langKey = TRANSLATIONS[userSettings.uiLanguage] ? userSettings.uiLanguage : 'de';
    const dict = TRANSLATIONS[langKey];
    document.documentElement.lang = langKey;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.dataset.i18n;
        const text = dict[key];
        if (!text) return;

        if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
            el.value = text;
        } else {
            el.innerText = text;
        }

        if (el.hasAttribute('aria-label')) {
            el.setAttribute('aria-label', text);
        }

        if (el.hasAttribute('title')) {
            el.setAttribute('title', text);
        }
    });

    statusFocusText = dict.status_focus;
    statusReceivingText = dict.status_receiving;
    statusHoldText = dict.status_hold;

    if (!isHolding && !overlay.classList.contains('show')) {
        status.innerText = statusFocusText;
    }

    settingsClose.setAttribute('aria-label', dict.btn_close);
    settingsBtn.setAttribute('aria-label', dict.settings_title);
}

function onDown(event) {
    if (overlay.classList.contains('show')) return;
    const point = event.touches ? event.touches[0] : event;
    isHolding = true;
    start = performance.now();
    distTotal = 0;
    last = { x: point.clientX, y: point.clientY };
    document.body.classList.add('active-state');
    status.innerText = statusReceivingText;
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
        status.innerText = statusHoldText;
        setTimeout(() => {
            if (!isHolding) status.innerText = statusFocusText;
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
    status.innerText = statusFocusText;
    selection = null;
}

function populateSettingsUI() {
    uiLanguageInputs.forEach((input) => {
        input.checked = input.value === userSettings.uiLanguage;
    });

    bookBOM.checked = userSettings.content.books.bom;
    bookOT.checked = userSettings.content.books.ot;
    bookNT.checked = userSettings.content.books.nt;
    langDE.checked = userSettings.content.languages.de;
    langEN.checked = userSettings.content.languages.en;
}

function readSettingsFromUI() {
    const selectedLanguage = Array.from(uiLanguageInputs).find((input) => input.checked)?.value || 'de';

    return {
        uiLanguage: selectedLanguage,
        content: {
            books: {
                bom: bookBOM.checked,
                ot: bookOT.checked,
                nt: bookNT.checked,
            },
            languages: {
                de: langDE.checked,
                en: langEN.checked,
            },
        },
    };
}

function openSettings() {
    populateSettingsUI();
    settingsOverlay.classList.add('show');
    settingsOverlay.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
    settingsOverlay.classList.remove('show');
    settingsOverlay.setAttribute('aria-hidden', 'true');
}

function saveSettings() {
    userSettings = { ...userSettings, ...readSettingsFromUI() };
    persistSettings();
    updateUILanguage();
    rebuildDatabase();
    closeSettings();
}

window.addEventListener('resize', initCanvas);
initCanvas();
requestAnimationFrame(drawParticles);

document.addEventListener('contextmenu', (e) => e.preventDefault());

document.getElementById('btn-reset').addEventListener('click', resetOverlay);
document.getElementById('btn-open').addEventListener('click', openSelection);

orb.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);

settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsSave.addEventListener('click', saveSettings);
settingsOverlay.addEventListener('click', (event) => {
    if (event.target === settingsOverlay) closeSettings();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && settingsOverlay.classList.contains('show')) {
        closeSettings();
    }
});

rebuildDatabase();
updateUILanguage();
