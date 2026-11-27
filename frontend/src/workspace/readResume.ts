import { getDocument, GlobalWorkerOptions, PasswordResponses } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function readResume(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a PDF smaller than 10 MB.');
  if (!file.size || !/\.pdf$/i.test(file.name)) throw new Error('Choose a non-empty PDF resume.');
  const data = new Uint8Array(await file.arrayBuffer());
  const document = getDocument({ data, useSystemFonts: true });
  let locked = false;
  document.onPassword = (respond: (password: string | Error) => void, reason: number) => {
    locked = reason === PasswordResponses.NEED_PASSWORD || reason === PasswordResponses.INCORRECT_PASSWORD;
    respond(new Error('Password-protected PDFs are unsupported.'));
  };
  try {
    const pdf = await document.promise;
    if (pdf.numPages > 25) throw new Error('Choose a PDF resume of 25 pages or fewer.');
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join(''));
      page.cleanup();
    }
    const text = pages.join('\n').trim();
    if (!text) throw new Error('This PDF has no selectable text. Use a text-based PDF or add skills manually.');
    return text;
  } catch (error) {
    if (locked) throw new Error('This PDF is password-protected. Choose an unlocked copy.');
    if (error instanceof Error && /^(Choose|This PDF)/.test(error.message)) throw error;
    throw new Error('This PDF could not be read. Try opening a different copy or add your skills manually.');
  } finally {
    await document.destroy().catch(() => undefined);
  }
}
