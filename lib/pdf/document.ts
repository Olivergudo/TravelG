export async function createPdfDocument(kicker: string, title: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 52, width = 595 - margin * 2, bottom = 790;
  let y = 54;
  const ensure = (height = 18) => { if (y + height > bottom) { pdf.addPage(); y = 58; } };
  const write = (text: string, options: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const size = options.size ?? 11;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? [23, 35, 29]));
    const chunks = pdf.splitTextToSize(text, width) as string[];
    chunks.forEach((chunk) => { ensure(size * 1.5); pdf.text(chunk, margin, y); y += size * 1.45; });
    y += options.gap ?? 0;
  };
  const section = (label: string) => { y += 12; write(label.toUpperCase(), { size: 10, bold: true, color: [23, 107, 70], gap: 4 }); };
  write(kicker.toUpperCase(), { size: 9, bold: true, color: [23, 107, 70], gap: 7 });
  write(title, { size: 22, bold: true, color: [23, 61, 45], gap: 8 });
  const finish = () => { y += 18; write("Generado con Gasto Listo", { size: 9, color: [110, 125, 117] }); return pdf.output("blob"); };
  return { write, section, finish };
}
