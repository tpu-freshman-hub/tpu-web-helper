const MONTHS_GENITIVE = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];
const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const TYPE_LABELS = { lecture: 'ЛК', practice: 'ПР', lab: 'ЛБ', other: '—' };
const TYPE_TITLES = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная работа', other: 'Другое' };

// State variables
let weeks = [];              // список недель
let todayWeekNumber = null;  // номер текущей недели (поле current)
let shownWeekNumber = null;  // номер недели, которая сейчас на экране
let shownWeekData = null;    // данные показанной недели

// DOM Elements cache
const els = {
    weekContainer: document.getElementById('week-container'),
    dayTabs: document.getElementById('day-tabs'),
    weekInfo: document.getElementById('week-info'),
    roRaspLink: document.getElementById('ro-rasp-link'),
    stateLoading: document.getElementById('state-loading'),
    stateError: document.getElementById('state-error'),
    errorRoRaspLink: document.getElementById('error-ro-rasp-link'),
    btnPrev: document.getElementById('week-prev'),
    btnToday: document.getElementById('week-today'),
    btnNext: document.getElementById('week-next')
};

function todayIso() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

function formatDateRange(startStr, endStr) {
    if (!startStr || !endStr) return '';
    const [y1, m1, d1] = startStr.split('-').map(Number);
    const [y2, m2, d2] = endStr.split('-').map(Number);
    const month1 = MONTHS_GENITIVE[m1 - 1];
    const month2 = MONTHS_GENITIVE[m2 - 1];
    
    if (m1 === m2) {
        return `${d1}–${d2} ${month1}`;
    }
    return `${d1} ${month1} – ${d2} ${month2}`;
}

function buildWeekHeaderLabel(weekObj) {
    if (!weekObj) return 'Загрузка…';
    const parityText = weekObj.parity === 'even' ? 'чётная' : 'нечётная';
    const dateRange = formatDateRange(weekObj.start, weekObj.end);
    return `Неделя ${weekObj.number} · ${parityText} · ${dateRange}`;
}

function raspUrl(number) {
    return `https://ro-rasp.tpu.ru/gruppa_45259/2026/${number}/view.html`;
}

function createSafeLink(text, url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    return a;
}

function createLessonCard(lesson) {
    const template = document.querySelector('#lesson-template');
    const card = template.content.firstElementChild.cloneNode(true);
    
    card.classList.add(`lesson--${lesson.type}`);
    card.querySelector('.lesson__time').textContent = `${lesson.pair} пара · ${lesson.start}–${lesson.end}`;
    card.querySelector('.lesson__title').textContent = lesson.discipline;
    
    const typeBadge = card.querySelector('.badge--type');
    typeBadge.textContent = TYPE_LABELS[lesson.type] || '—';
    typeBadge.classList.add(`badge--${lesson.type}`);
    typeBadge.title = TYPE_TITLES[lesson.type] || 'Занятие';
    
    const subBadge = card.querySelector('.badge--subgroup');
    if (lesson.subgroup !== null && lesson.subgroup !== undefined) {
        subBadge.textContent = `Подгр. ${lesson.subgroup}`;
        subBadge.hidden = false;
    } else {
        subBadge.hidden = true;
    }
    
    const teachersList = card.querySelector('.lesson__teachers');
    if (lesson.teachers && lesson.teachers.length > 0) {
        lesson.teachers.forEach(t => {
            const li = document.createElement('li');
            if (t.url) {
                li.appendChild(createSafeLink(t.name, t.url));
            } else {
                li.textContent = t.name;
            }
            teachersList.appendChild(li);
        });
    } else {
        teachersList.hidden = true;
    }
    
    const roomsList = card.querySelector('.lesson__rooms');
    if (lesson.rooms && Array.isArray(lesson.rooms) && lesson.rooms.length > 0) {
        lesson.rooms.forEach(r => {
            const li = document.createElement('li');
            if (typeof r === 'object' && r.url) {
                li.appendChild(createSafeLink(r.name, r.url));
            } else {
                li.textContent = r;
            }
            roomsList.appendChild(li);
        });
    } else {
        roomsList.hidden = true;
    }
    
    const moodleBtn = card.querySelector('.lesson__moodle');
    if (lesson.moodle_url) {
        moodleBtn.href = lesson.moodle_url;
        moodleBtn.hidden = false;
    } else {
        moodleBtn.hidden = true;
    }
    
    return card;
}

function isDesktopView() {
    // ИЗМЕНЕНО: 768px заменено на 1024px
    return window.matchMedia('(min-width: 1024px)').matches;
}

function updateLayoutMode() {
    const weekContainer = els.weekContainer;
    if (!weekContainer) return;
    
    if (isDesktopView()) {
        weekContainer.classList.add('is-desktop-grid');
        document.querySelectorAll('.mobile-day').forEach(d => d.classList.remove('is-selected'));
    } else {
        weekContainer.classList.remove('is-desktop-grid');
        
        let activeTab = document.querySelector('.day-tab.is-selected');
        if (!activeTab) {
            activeTab = document.querySelector('.day-tab');
            if (activeTab) {
                activeTab.classList.add('is-selected');
            }
        }
        
        if (activeTab) {
            const date = activeTab.dataset.date;
            const daySection = document.querySelector(`.mobile-day[data-date="${date}"]`);
            if (daySection) {
                daySection.classList.add('is-selected');
            }
        }
    }
}

function renderWeek(weekData) {
    if (!weekData) return;

    els.weekContainer.innerHTML = '';
    els.dayTabs.innerHTML = '';
    
    const today = todayIso();
    let defaultDateToSelect = weekData.days[0]?.date;
    let todayIndex = -1; 
    
    // --- Создаём заголовки для десктопной сетки ---
    const headerRow = document.createElement('div');
    headerRow.className = 'grid-row header-row';
    headerRow.innerHTML = '<div class="grid-cell time-header">Время</div>';
    els.weekContainer.appendChild(headerRow);
    
    // --- Рендер табов и сбор данных для сетки ---
    const daysData = [];
    weekData.days.forEach((day, index) => {
        const [y, m, d] = day.date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayName = DAYS_SHORT[dateObj.getDay()];
        const tabTextDate = `${d}.${m}`;
        
        // Заголовок колонки (Десктоп)
        const headerCell = document.createElement('div');
        headerCell.className = 'grid-cell day-header';
        if (day.date === today) {
            headerCell.classList.add('is-today');
            todayIndex = index;
            defaultDateToSelect = day.date;
        }
        headerCell.textContent = `${dayName} ${tabTextDate}`;
        headerRow.appendChild(headerCell);
        
        // Таб для мобильных
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'day-tab';
        tabBtn.dataset.date = day.date;
        tabBtn.innerHTML = `<span class="day-tab__name">${dayName}</span><span class="day-tab__date">${tabTextDate}</span>`;
        
        if (day.date === today) {
            tabBtn.classList.add('is-today');
            defaultDateToSelect = day.date;
        }
        
        tabBtn.addEventListener('click', (e) => {
            if (isDesktopView()) return;
            const clickedDate = e.currentTarget.dataset.date;
            document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('is-selected'));
            document.querySelectorAll('.mobile-day').forEach(d => d.classList.remove('is-selected'));
            e.currentTarget.classList.add('is-selected');
            const targetDay = document.querySelector(`.mobile-day[data-date="${clickedDate}"]`);
            if (targetDay) targetDay.classList.add('is-selected');
        });
        
        els.dayTabs.appendChild(tabBtn);
        
        daysData.push({
            date: day.date,
            lessons: day.lessons || []
        });
        
        // Мобильный день
        const mobileDay = document.createElement('section');
        mobileDay.className = 'mobile-day';
        mobileDay.dataset.date = day.date;
        
        if (!day.lessons || day.lessons.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'state-card state-card--empty';
            emptyMsg.innerHTML = `<i class="fa-regular fa-calendar-xmark"></i><p>Пар нет</p>`;
            mobileDay.appendChild(emptyMsg);
        } else {
            let currentPair = null;
            let currentSlot = null;
            day.lessons.forEach(lesson => {
                if (lesson.pair !== currentPair) {
                    currentPair = lesson.pair;
                    currentSlot = document.createElement('div');
                    currentSlot.className = 'slot';
                    currentSlot.dataset.pair = currentPair;
                    mobileDay.appendChild(currentSlot);
                }
                currentSlot.appendChild(createLessonCard(lesson));
            });
        }
        els.weekContainer.appendChild(mobileDay);
    });
    
    // --- Создаём фиксированную сетку для десктопа ---
    const allPairs = new Set();
    daysData.forEach(day => {
        day.lessons.forEach(lesson => {
            allPairs.add(lesson.pair);
        });
    });
    
    const sortedPairs = Array.from(allPairs).sort((a, b) => a - b);
    
    sortedPairs.forEach(pairNum => {
        const row = document.createElement('div');
        row.className = 'grid-row';
        row.dataset.pair = pairNum;
        
        const timeCell = document.createElement('div');
        timeCell.className = 'grid-cell time-cell';
        let timeText = `${pairNum} пара`;
        for (const day of daysData) {
            const lesson = day.lessons.find(l => l.pair === pairNum);
            if (lesson) {
                timeText = `${pairNum} пара · ${lesson.start}–${lesson.end}`;
                break;
            }
        }
        timeCell.textContent = timeText;
        row.appendChild(timeCell);
        
        daysData.forEach((day, colIndex) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell day-cell';
            if (colIndex === todayIndex) {
                cell.classList.add('is-today-column');
            }
            
            const dayLessons = day.lessons.filter(l => l.pair === pairNum);
            if (dayLessons.length > 0) {
                const slot = document.createElement('div');
                slot.className = 'slot';
                slot.dataset.pair = pairNum;
                dayLessons.forEach(lesson => {
                    slot.appendChild(createLessonCard(lesson));
                });
                cell.appendChild(slot);
            }
            row.appendChild(cell);
        });
        
        els.weekContainer.appendChild(row);
    });
    
    updateLayoutMode();
    
    const defaultTab = els.dayTabs.querySelector(`.day-tab[data-date="${defaultDateToSelect}"]`);
    const defaultDay = els.weekContainer.querySelector(`.mobile-day[data-date="${defaultDateToSelect}"]`);
    
    if (defaultTab && defaultDay) {
        defaultTab.classList.add('is-selected');
        defaultDay.classList.add('is-selected');
    }
}

async function loadWeek(number) {
    if (!number) return;
    
    shownWeekNumber = number;
    
    // Обновляем заголовок сразу из списка weeks
    const weekMeta = weeks.find(w => w.number === number);
    if (weekMeta) {
        els.weekInfo.textContent = buildWeekHeaderLabel(weekMeta);
        els.roRaspLink.href = weekMeta.rasp_url || raspUrl(number);
        els.errorRoRaspLink.href = weekMeta.rasp_url || raspUrl(number);
    } else {
        els.weekInfo.textContent = `Неделя ${number}`;
        els.roRaspLink.href = raspUrl(number);
        els.errorRoRaspLink.href = raspUrl(number);
    }

    // UI Loading state
    els.stateLoading.hidden = false;
    els.stateError.hidden = true;
    els.weekContainer.hidden = true;
    els.dayTabs.hidden = true;
    
    // Disable nav buttons during load
    els.btnPrev.disabled = true;
    els.btnToday.disabled = true;
    els.btnNext.disabled = true;

    try {
        const response = await fetch(scheduleUrl(number));
        if (!response.ok) throw new Error(`Ошибка загрузки расписания: ${response.status}`);
        
        const weekData = await response.json();
        shownWeekData = weekData;
        
        if (weekData.rasp_url) {
            els.roRaspLink.href = weekData.rasp_url;
            els.errorRoRaspLink.href = weekData.rasp_url;
        }

        renderWeek(weekData);
        
        els.stateLoading.hidden = true;
        els.weekContainer.hidden = false;
        els.dayTabs.hidden = false;
        
    } catch (error) {
        console.error('Ошибка загрузки недели:', error);
        els.stateLoading.hidden = true;
        els.stateError.hidden = false;
    } finally {
        updateNavButtons();
    }
}

function updateNavButtons() {
    if (weeks.length === 0) {
        els.btnPrev.disabled = true;
        els.btnNext.disabled = true;
        return;
    }
    
    const minWeek = weeks[0].number;
    const maxWeek = weeks[weeks.length - 1].number;
    
    els.btnPrev.disabled = (shownWeekNumber <= minWeek);
    els.btnNext.disabled = (shownWeekNumber >= maxWeek);
    els.btnToday.disabled = false;
}

async function init() {
    try {
        const weeksResponse = await fetch(weeksUrl());
        if (!weeksResponse.ok) throw new Error(`Ошибка загрузки недель: ${weeksResponse.status}`);
        
        const weeksData = await weeksResponse.json();
        weeks = weeksData.weeks || [];
        todayWeekNumber = weeksData.current;
        
        if (!todayWeekNumber && weeks.length > 0) {
            todayWeekNumber = weeks[0].number;
        }

        // Setup Event Listeners (once)
        els.btnPrev.addEventListener('click', () => {
            if (shownWeekNumber > weeks[0].number) {
                loadWeek(shownWeekNumber - 1);
            }
        });
        
        els.btnNext.addEventListener('click', () => {
            if (shownWeekNumber < weeks[weeks.length - 1].number) {
                loadWeek(shownWeekNumber + 1);
            }
        });
        
        els.btnToday.addEventListener('click', () => {
            loadWeek(todayWeekNumber);
        });

        window.addEventListener('resize', updateLayoutMode);
        
        if (todayWeekNumber) {
            await loadWeek(todayWeekNumber);
        } else {
            throw new Error('No current week defined');
        }
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        els.stateLoading.hidden = true;
        els.stateError.hidden = false;
        els.weekInfo.textContent = 'Ошибка загрузки списка недель';
    }
}

document.addEventListener('DOMContentLoaded', init);
