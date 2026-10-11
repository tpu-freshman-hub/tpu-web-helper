document.addEventListener('DOMContentLoaded', () => {
  // Элементы навигации
  const navHomeBtn = document.getElementById('nav-home');
  const navSchedBtn = document.getElementById('nav-schedule');
  const viewHome = document.getElementById('view-home');
  const viewSched = document.getElementById('view-schedule');

  // Переключение вкладок Главная / Расписание
  function switchView(target) {
    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    if (target === 'home') {
      viewHome.classList.add('active');
      navHomeBtn.classList.add('active');
    } else {
      viewSched.classList.add('active');
      navSchedBtn.classList.add('active');
    }
  }

  if (navHomeBtn) navHomeBtn.addEventListener('click', () => switchView('home'));
  if (navSchedBtn) navSchedBtn.addEventListener('click', () => switchView('schedule'));

  // Карточка-кнопка на главной
  const scheduleTrigger = document.getElementById('schedule-trigger');
  if (scheduleTrigger) {
    scheduleTrigger.addEventListener('click', () => {
      switchView('schedule');
      // Плавная прокрутка к началу расписания
      if (viewSched) viewSched.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // --- Статичное расписание (вместо JSON и Google Sheets) ---
  const scheduleData = {
    mon: [
      { time: '08:30', pair: '1 пара', subject: 'Высшая математика', type: 'lecture', teacher: 'Петров П.П.', location: 'ауд. 101' },
      { time: '10:25', pair: '2 пара', subject: 'Физика', type: 'practice', teacher: 'Сидоров С.С.', location: 'ауд. 205' }
    ],
    tue: [
      { time: '12:10', pair: '3 пара', subject: 'Информатика', type: 'lab', teacher: 'Иванов И.И.', location: 'лаб. 302' }
    ],
    wed: [],
    thu: [
      { time: '08:30', pair: '1 пара', subject: 'Химия', type: 'lecture', teacher: 'Кузнецова К.К.', location: 'ауд. 110' }
    ],
    fri: [],
    sat: []
  };

  const cardsContainer = document.querySelector('.cards-container');
  const buttons = document.querySelectorAll('.day-btn');

  // Отрисовка карточки занятия
  function renderCard(item) {
    const typeClass = `tag-\${item.type}`;
    const typeLabel = item.type === 'lecture' ? 'Лекция' :
                       item.type === 'practice' ? 'Практика' : 'Лабораторная';
    const groupTag = item.group
      ? `<span class="tag tag-group">Подгруппа \${item.group.charAt(1)}</span>`
      : '';

    return `
      <article class="class-card">
        <header class="card-header">
          <span class="time">\${item.time}</span>
          <span class="pair-number">\${item.pair}</span>
        </header>
        <h3 class="subject">\${item.subject}</h3>
        <div class="tags">
          <span class="${typeClass}">${typeLabel}</span>
          \${groupTag}
        </div>
        <p class="teacher">Преподаватель: \${item.teacher}</p>
        <p class="location">\${item.location}</p>
      </article>
    `;
  }

  // Показать расписание для конкретного дня
  function showDay(dayKey) {
    if (!cardsContainer) return;
    cardsContainer.innerHTML = '';

    const items = scheduleData[dayKey];
    if (!items || items.length === 0) {
      cardsContainer.innerHTML = '<div class="no-classes">Нет занятий на этот день</div>';
      return;
    }

    items.forEach(item => {
      cardsContainer.insertAdjacentHTML('beforeend', renderCard(item));
    });
  }

  // Обработчики кнопок дней недели
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const day = btn.dataset.day;
      if (day) showDay(day);
    });
  });

  // По умолчанию показываем понедельник
  showDay('mon');
});
