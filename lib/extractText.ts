/**
 * Client-side utility for extracting text from PDF and TXT files.
 * This runs directly in the user's browser, bypassing Vercel's 4.5 MB payload limit.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    const text = await file.text();
    return text.trim();
  }

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure worker from CDN to avoid bundler/worker chunking issues in Next.js
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n\n';
    }

    const trimmed = fullText.trim();
    if (!trimmed) {
      throw new Error(
        'No readable text could be extracted. The document may be a scanned image or photo. Please upload a PDF with selectable text.'
      );
    }

    return trimmed;
  }

  throw new Error('Unsupported file type. Please upload a .pdf or .txt file.');
}
