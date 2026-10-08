// Сжатие больших текстовых файлов перед отправкой. Выписки 1С — десятки процентов повторяющегося текста: файл в 9 МБ
// сжимается примерно до 0,5 МБ, и загрузка укладывается в таймаут прокси даже на медленном канале.
// Бэкенд принимает файлы с суффиксом .gz и распаковывает их (имя без «.gz»).

export const COMPRESS_MIN_BYTES = 256 * 1024;

export const canCompress = () => typeof CompressionStream === 'function';

// Сжимаем только крупные .txt (реестры и выписки); zip уже сжат, мелкие файлы не стоят усилий.
export const shouldCompress = (file) => canCompress() && /\.txt$/i.test(file.name) && file.size >= COMPRESS_MIN_BYTES;

// Возвращает сжатый File с именем «<имя>.gz» или исходный файл, если сжимать не нужно или не получилось.
export async function maybeGzip(file) {
  if (!shouldCompress(file)) return file;
  try {
    const blob = await new Response(file.stream().pipeThrough(new CompressionStream('gzip'))).blob();
    return new File([blob], `${file.name}.gz`, { type: 'application/gzip' });
  } catch {
    return file; // без сжатия загрузка тоже работает, просто медленнее
  }
}
