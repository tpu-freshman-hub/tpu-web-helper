const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];
const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const TYPE_LABELS = { lecture: 'ЛК', practice: 'ПР', lab: 'ЛБ', other: '—' };
const TYPE_TITLES = { lecture: 'Лекция', practice: 'Практика', lab: 'Лабораторная работа', other: 'Другое' };

function todayIso() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatDateRange(startStr, endStr) {
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);
  
  const month1 = MONTHS_GENITIVE[m1 - 1];
  const month2 = MONTHS_GENITIVE[m2 - 1];

  if (m1 === m2) {
    return `${d1}–${d2} ${month1}`;
  }
  return `${d1} ${month1} – ${d2} ${month2}`;
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
  if (lesson.rooms && lesson.rooms.length > 0) {
    lesson.rooms.forEach(r => {
      const li = document.createElement('li');
      if (r.url) {
        li.appendChild(createSafeLink(r.name, r.url));
      } else {
        li.textContent = r.name;
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
  return window.matchMedia('(min-width: 768px)').matches;
}

function updateLayoutMode() {
  const weekContainer = document.getElementById('week-container');
  if (!weekContainer) return;

  if (isDesktopView()) {
    weekContainer.classList.add('is-desktop-grid');
    document.querySelectorAll('.day').forEach(d => d.classList.remove('is-selected'));
  } else {
    weekContainer.classList.remove('is-desktop-grid');
    const activeTab = document.querySelector('.day-tab.is-selected');
    if (activeTab) {
      const date = activeTab.dataset.date;
      const daySection = document.querySelector(`.day[data-date="${date}"]`);
      if (daySection) daySection.classList.add('is-selected');
    }
  }
}

async function initSchedule() {
  const weekContainer = document.getElementById('week-container');
  const dayTabs = document.getElementById('day-tabs');
  const weekInfo = document.getElementById('week-info');
  const roRaspLink = document.getElementById('ro-rasp-link');
  const stateLoading = document.getElementById('state-loading');
  const stateError = document.getElementById('state-error');
  const errorRoRaspLink = document.getElementById('error-ro-rasp-link');

  function showLoading() {
    stateLoading.hidden = false;
    stateError.hidden = true;
    weekContainer.hidden = true;
    dayTabs.hidden = true;
  }

  function showError(fallbackUrl) {
    stateLoading.hidden = true;
    stateError.hidden = false;
    weekContainer.hidden = true;
    dayTabs.hidden = true;
    if (fallbackUrl) errorRoRaspLink.href = fallbackUrl;
  }

  function showContent() {
    stateLoading.hidden = true;
    stateError.hidden = true;
    weekContainer.hidden = false;
    dayTabs.hidden = false;
  }

  showLoading();

  try {
    const weeksResponse = await fetch(weeksUrl());
    if (!weeksResponse.ok) throw new Error(`Ошибка загрузки недель: ${weeksResponse.status}`);
    const weeksData = await weeksResponse.json();
    const currentWeek = weeksData.current;

    const scheduleResponse = await fetch(scheduleUrl(currentWeek));
    if (!scheduleResponse.ok) throw new Error(`Ошибка загрузки расписания: ${scheduleResponse.status}`);
    const weekData = await scheduleResponse.json();

    const parityText = weekData.parity === 'even' ? 'чётная' : 'нечётная';
    const dateRange = formatDateRange(weekData.start, weekData.end);
    weekInfo.textContent = `Неделя ${currentWeek} · ${parityText} · ${dateRange}`;
    if (weekData.rasp_url) roRaspLink.href = weekData.rasp_url;

    weekContainer.innerHTML = '';
    dayTabs.innerHTML = '';

    const today = todayIso();
    let defaultDateToSelect = weekData.days[0]?.date;

    // --- Создаём заголовки для десктопной сетки ---
    const headerRow = document.createElement('div');
    headerRow.className = 'grid-row header-row';
    headerRow.innerHTML = '<div class="grid-cell time-header">Время</div>';
    weekContainer.appendChild(headerRow);

    // --- Рендер табов и сбор данных для сетки ---
    const daysData = [];
    
    weekData.days.forEach(day => {
      const [y, m, d] = day.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = DAYS_SHORT[dateObj.getDay()];
      const tabTextDate = `${d}.${m}`;

      // Заголовок колонки
      const headerCell = document.createElement('div');
      headerCell.className = 'grid-cell day-header';
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

      dayTabs.appendChild(tabBtn);

      // Сохраняем данные дня
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

      weekContainer.appendChild(mobileDay);
    });

    // --- Создаём фиксированную сетку для десктопа ---
    // Собираем все уникальные номера пар со всей недели
    const allPairs = new Set();
    daysData.forEach(day => {
      day.lessons.forEach(lesson => {
        allPairs.add(lesson.pair);
      });
    });
    
    // Сортируем пары по номеру
    const sortedPairs = Array.from(allPairs).sort((a, b) => a - b);

    // Создаём строку для каждой пары
    sortedPairs.forEach(pairNum => {
      const row = document.createElement('div');
      row.className = 'grid-row';
      row.dataset.pair = pairNum;

      // Ячейка времени (первая колонка)
      const timeCell = document.createElement('div');
      timeCell.className = 'grid-cell time-cell';
      
      // Находим время для этой пары (берём из первого занятия с этим номером)
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

      // Ячейки для каждого дня
      daysData.forEach(day => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell day-cell';
        
        // Ищем занятия с этим номером пары в этот день
        const dayLessons = day.lessons.filter(l => l.pair === pairNum);
        
        if (dayLessons.length > 0) {
          // Создаём слот для занятий
          const slot = document.createElement('div');
          slot.className = 'slot';
          slot.dataset.pair = pairNum;
          
          dayLessons.forEach(lesson => {
            slot.appendChild(createLessonCard(lesson));
          });
          
          cell.appendChild(slot);
        }
        // Если занятий нет, ячейка остаётся пустой
        
        row.appendChild(cell);
      });

      weekContainer.appendChild(row);
    });

    updateLayoutMode();

    if (!isDesktopView()) {
      const defaultTab = dayTabs.querySelector(`.day-tab[data-date="${defaultDateToSelect}"]`);
      const defaultDay = weekContainer.querySelector(`.mobile-day[data-date="${defaultDateToSelect}"]`);
      if (defaultTab && defaultDay) {
        defaultTab.classList.add('is-selected');
        defaultDay.classList.add('is-selected');
      }
    }

    window.addEventListener('resize', updateLayoutMode);

    showContent();

  } catch (error) {
    console.error('Ошибка инициализации расписания:', error);
    showError('https://ro-rasp.tpu.ru/');
  }
}

document.addEventListener('DOMContentLoaded', initSchedule);
