'use strict';

const NOTES_KEY = 'hub8k64:notes';

/* ---------- Часть А: контракт ---------- */ 

function getNote(key) {
  const notes = readNotes();
  return Object.prototype.hasOwnProperty.call(notes, key) ? notes[key] : null;
}

function setNote(key, text) {
  const trimmed = String(text).trim();
  const notes = readNotes();
  if (trimmed === '') {
    delete notes[key];
  } else {
    notes[key] = trimmed;
  }
  return writeNotes(notes);
}

function readNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function writeNotes(notes) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch (error) {
    return false;
  }
}

function noteKey(date, pair, discipline) {
  return [date, pair, discipline].join('|');
}

/* ---------- Часть Б: карточка ---------- */

function renderNote(card) {
  const key = card.dataset.noteKey;
  if (!key) return;

  const text = getNote(key);

  let noteText = card.querySelector('.lesson__note-text');
  if (!noteText) {
    noteText = document.createElement('p');
    noteText.className = 'lesson__note-text';
    noteText.hidden = true;
    const actions = card.querySelector('.lesson__actions');
    if (actions) {
      actions.before(noteText);
    } else {
      card.append(noteText);
    }
  }

  const btn = card.querySelector('.lesson__note-btn');
  if (text !== null) {
    noteText.textContent = text;   // только textContent: пользовательский текст, никакого innerHTML
    noteText.hidden = false;
    if (btn) btn.classList.add('has-note');
  } else {
    noteText.hidden = true;
    if (btn) btn.classList.remove('has-note');
  }
}

function attachNote(card, key) {
  card.dataset.noteKey = key;

  renderNote(card);

  const btn = card.querySelector('.lesson__note-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (card.querySelector('.lesson__note-editor')) {
      closeNoteEditor(card);
    } else {
      openNoteEditor(card);
    }
  });
}

/* ---------- Редактор ---------- */

function createNoteButton(label, className) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className + ' btn'; // .btn — общий класс кнопок из вёрстки; поправьте на свой
  btn.textContent = label;
  return btn;
}

function openNoteEditor(card) {
  const key = card.dataset.noteKey;
  const actions = card.querySelector('.lesson__actions');
  if (!actions) return;

  const editor = document.createElement('div');
  editor.className = 'lesson__note-editor';

  const textarea = document.createElement('textarea');
  textarea.className = 'lesson__note-input';
  textarea.maxLength = 300;
  textarea.rows = 3;
  textarea.setAttribute('aria-label', 'Текст заметки');
  textarea.value = getNote(key) || '';

  const buttons = document.createElement('div');
  buttons.className = 'lesson__note-buttons';
  const saveBtn = createNoteButton('Сохранить', 'lesson__note-save');
  const deleteBtn = createNoteButton('Удалить', 'lesson__note-delete');
  const cancelBtn = createNoteButton('Отмена', 'lesson__note-cancel');
  buttons.append(saveBtn, deleteBtn, cancelBtn);

  editor.append(textarea, buttons);
  actions.after(editor);

  saveBtn.addEventListener('click', () => {
    if (setNote(key, textarea.value)) {
      closeNoteEditor(card);
      refreshNotes(key);
    } else {
      showNoteError(editor);
    }
  });

  deleteBtn.addEventListener('click', () => {
    if (setNote(key, '')) {
      closeNoteEditor(card);
      refreshNotes(key);
    } else {
      showNoteError(editor);
    }
  });

  cancelBtn.addEventListener('click', () => closeNoteEditor(card));

  textarea.focus();
}

function showNoteError(editor) {
  let error = editor.querySelector('.lesson__note-error');
  if (!error) {
    error = document.createElement('p');
    error.className = 'lesson__note-error';
    editor.append(error);
  }
  error.textContent = 'Не удалось сохранить: браузер запретил сохранение данных';
}

function closeNoteEditor(card) {
  const editor = card.querySelector('.lesson__note-editor');
  if (editor) editor.remove();
}

function refreshNotes(key) {
  document.querySelectorAll('.lesson').forEach((card) => {
    if (card.dataset.noteKey === key) {
      renderNote(card);
    }
  });
}
