// Источник данных для фронта.
// true — читаем моки из frontend/mock/, false — ходим в настоящий API.
const USE_MOCK = true;

function weeksUrl() {
  return USE_MOCK ? 'mock/weeks.json' : '/api/weeks';
}

function scheduleUrl(week) {
  return USE_MOCK ? `mock/week_${week}.json` : `/api/schedule?week=${week}`;
}