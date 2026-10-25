// Число из буфера обмена в виде, который понимает поле type="number": запятая -> точка, пробелы (в т.ч. тонкие и
// неразрывные, разделители тысяч) убираются. Не число — null (вставку тогда не трогаем).
export function normalizeDecimal(text) {
  const t = String(text ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? t : null;
}
