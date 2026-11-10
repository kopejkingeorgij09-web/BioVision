// Clipboard reads are only initiated by the user's Paste button.
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/heic': 'heic', 'image/heif': 'heif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf' };
const pending = new Map();

window.notesClipboardResult = (id, files, error) => {
  const request = pending.get(id);
  if (!request) return;
  pending.delete(id);
  clearTimeout(request.timer);
  if (error) request.reject(new Error(error));
  else request.resolve(files);
};

export function clipboardFiles(data) {
  const files = Array.from(data?.files ?? []);
  if (files.length) return files;
  return Array.from(data?.items ?? []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
}

export async function readClipboardFiles() {
  if (window.NotesAndroid?.readClipboard) {
    const id = crypto.randomUUID();
    const descriptors = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Не удалось прочитать буфер. Попробуй ещё раз.')); }, 30000);
      pending.set(id, { resolve, reject, timer });
      try { window.NotesAndroid.readClipboard(id); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
    return Promise.all(descriptors.map(async file => {
      const response = await fetch('/clipboard/' + encodeURIComponent(file.token));
      if (!response.ok) throw new Error('Не удалось получить файл из буфера');
      return new File([await response.blob()], file.name, { type: file.mime });
    }));
  }
  if (!navigator.clipboard?.read) throw new Error('Этот браузер не поддерживает кнопку вставки. Используй системное «Вставить», Ctrl+V или «Прикрепить».');
  let items;
  try { items = await navigator.clipboard.read(); }
  catch { throw new Error('Нет доступа к буферу. Разреши вставку в браузере или используй «Прикрепить».'); }
  const files = [];
  for (const item of items) {
    // A clipboard item can expose the same image in several formats.
    const type = item.types.find(type => extensions[type]);
    if (type) files.push(new File([await item.getType(type)], 'Вставка-' + (files.length + 1) + '.' + extensions[type], { type }));
  }
  return files;
}
