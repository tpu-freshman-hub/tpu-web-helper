'use strict';
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
    noteText.textContent = text;
    noteText.hidden = false;
    if (btn) btn.classList.add('has-note');
  } else {
    noteText.hidden = true;
    if (btn) btn.classList.remove('has-note');
  }
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

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'lesson__note-save';
  saveBtn.textContent = 'Сохранить';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'lesson__note-delete';
  deleteBtn.textContent = 'Удалить';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'lesson__note-cancel';
  cancelBtn.textContent = 'Отмена';

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

function closeNoteEditor(card) {
  const editor = card.querySelector('.lesson__note-editor');
  if (editor) editor.remove();
}

function showNoteError(editor) {
  let error = editor.querySelector('.lesson__note-error');
  if (!error) {
    error = document.createElement('p');
    error.className = 'lesson__note-error';
    const buttons = editor.querySelector('.lesson__note-buttons');
    editor.append(error);
    if (buttons) {
      buttons.before(error);
    } else {
      editor.append(error); // страховка, если блок кнопок не нашёлся
    }
  }
  error.textContent = 'Не удалось сохранить: браузер запретил сохранение данных';
}

function refreshNotes(key) {
  document.querySelectorAll('.lesson').forEach((card) => {
    if (card.dataset.noteKey === key) {
      renderNote(card);
    }
  });
}