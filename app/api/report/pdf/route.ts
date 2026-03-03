/**
 * POST /api/report/pdf
 *
 * Generates a downloadable PDF clinical report using pdf-lib.
 * The PDF includes an AutiSense branded header, child information,
 * score summary table, the full report text, and a disclaimer footer.
 *
 * Request body:
 *   {
 *     report: string,
 *     childName: string,
 *     sessionDate: string,
 *     scores: { gaze: number, motor: number, vocal: number, overall: number }
 *   }
 *
 * Response:
 *   Binary PDF (Content-Type: application/pdf)
 */

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface PdfRequestBody {
  report: string;
  childName: string;
  sessionDate: string;
  scores: {
    gaze: number;
    motor: number;
    vocal: number;
    overall: number;
  };
}

// AutiSense brand green
const SAGE_500 = rgb(77 / 255, 128 / 255, 88 / 255);
const SAGE_100 = rgb(227 / 255, 237 / 255, 230 / 255);
const TEXT_PRIMARY = rgb(45 / 255, 58 / 255, 48 / 255);
const TEXT_SECONDARY = rgb(90 / 255, 112 / 255, 96 / 255);
const TEXT_MUTED = rgb(154 / 255, 176 / 255, 159 / 255);
const WHITE = rgb(1, 1, 1);

/**
 * Word-wraps text to fit within a given width.
 */
function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export async function POST(req: NextRequest) {
  let body: PdfRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body?.report || !body?.childName || !body?.sessionDate || !body?.scores) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: report, childName, sessionDate, scores",
      },
      { status: 400 },
    );
  }

  const { report, childName, sessionDate, scores } = body;

  try {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_WIDTH = 595.28; // A4
    const PAGE_HEIGHT = 841.89;
    const MARGIN = 50;
    const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    /**
     * Adds a new page and resets the y-cursor.
     */
    function addNewPage() {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    /**
     * Ensures enough space remains on the current page;
     * creates a new page if not.
     */
    function ensureSpace(needed: number) {
      if (y - needed < MARGIN + 40) {
        addNewPage();
      }
    }

    // ── Header: green accent bar ────────────────────────────────
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 80,
      width: PAGE_WIDTH,
      height: 80,
      color: SAGE_500,
    });

    page.drawText("AutiSense", {
      x: MARGIN,
      y: PAGE_HEIGHT - 35,
      size: 22,
      font: helveticaBold,
      color: WHITE,
    });

    page.drawText("AI-Powered Autism Screening Report", {
      x: MARGIN,
      y: PAGE_HEIGHT - 55,
      size: 11,
      font: helvetica,
      color: rgb(1, 1, 1),
    });

    page.drawText(`Generated: ${new Date().toLocaleDateString("en-GB")}`, {
      x: PAGE_WIDTH - MARGIN - 130,
      y: PAGE_HEIGHT - 35,
      size: 9,
      font: helvetica,
      color: rgb(0.9, 0.95, 0.91),
    });

    y = PAGE_HEIGHT - 110;

    // ── Child Info Section ────────────────────────────────────────
    page.drawRectangle({
      x: MARGIN,
      y: y - 50,
      width: CONTENT_WIDTH,
      height: 50,
      color: SAGE_100,
      borderColor: SAGE_500,
      borderWidth: 1,
    });

    page.drawText("Child Information", {
      x: MARGIN + 12,
      y: y - 18,
      size: 11,
      font: helveticaBold,
      color: TEXT_PRIMARY,
    });

    page.drawText(`Name: ${childName}`, {
      x: MARGIN + 12,
      y: y - 38,
      size: 10,
      font: helvetica,
      color: TEXT_SECONDARY,
    });

    page.drawText(`Session Date: ${sessionDate}`, {
      x: MARGIN + 250,
      y: y - 38,
      size: 10,
      font: helvetica,
      color: TEXT_SECONDARY,
    });

    y -= 72;

    // ── Score Summary Table ──────────────────────────────────────
    ensureSpace(100);

    page.drawText("Score Summary", {
      x: MARGIN,
      y,
      size: 13,
      font: helveticaBold,
      color: TEXT_PRIMARY,
    });
    y -= 22;

    const scoreLabels = [
      { label: "Gaze Tracking", value: scores.gaze },
      { label: "Motor Coordination", value: scores.motor },
      { label: "Vocalization", value: scores.vocal },
      { label: "Overall Score", value: scores.overall },
    ];

    const COL_WIDTH = CONTENT_WIDTH / 4;

    // Table header
    page.drawRectangle({
      x: MARGIN,
      y: y - 18,
      width: CONTENT_WIDTH,
      height: 22,
      color: SAGE_500,
    });

    for (let i = 0; i < scoreLabels.length; i++) {
      page.drawText(scoreLabels[i].label, {
        x: MARGIN + i * COL_WIDTH + 8,
        y: y - 13,
        size: 9,
        font: helveticaBold,
        color: WHITE,
      });
    }
    y -= 18;

    // Table row
    page.drawRectangle({
      x: MARGIN,
      y: y - 24,
      width: CONTENT_WIDTH,
      height: 24,
      color: SAGE_100,
      borderColor: SAGE_500,
      borderWidth: 0.5,
    });

    for (let i = 0; i < scoreLabels.length; i++) {
      const val = scoreLabels[i].value;
      const displayVal =
        scoreLabels[i].label === "Overall Score"
          ? `${val}/100`
          : `${(val * 100).toFixed(0)}%`;

      page.drawText(displayVal, {
        x: MARGIN + i * COL_WIDTH + 8,
        y: y - 17,
        size: 10,
        font: helveticaBold,
        color: TEXT_PRIMARY,
      });
    }
    y -= 46;

    // ── Full Report Text ─────────────────────────────────────────
    ensureSpace(30);

    page.drawText("Clinical Screening Report", {
      x: MARGIN,
      y,
      size: 14,
      font: helveticaBold,
      color: TEXT_PRIMARY,
    });
    y -= 20;

    // Horizontal rule
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: SAGE_500,
    });
    y -= 14;

    // Wrap and render report text
    const wrappedLines = wrapText(report, helvetica, 9.5, CONTENT_WIDTH);
    const LINE_HEIGHT = 13;

    for (const line of wrappedLines) {
      ensureSpace(LINE_HEIGHT + 5);

      // Detect section headers (all caps or lines starting with CRITERION/MOTOR/RECOMMENDATION)
      const isHeader =
        /^(CRITERION|MOTOR|RECOMMENDATION|IMPORTANT)/i.test(line) ||
        (line === line.toUpperCase() && line.length > 3 && /[A-Z]/.test(line));

      if (isHeader) {
        y -= 6; // extra spacing before headers
        ensureSpace(LINE_HEIGHT + 10);
        page.drawText(line, {
          x: MARGIN,
          y,
          size: 10,
          font: helveticaBold,
          color: SAGE_500,
        });
      } else if (line === "") {
        // blank line — just add spacing
      } else {
        page.drawText(line, {
          x: MARGIN,
          y,
          size: 9.5,
          font: helvetica,
          color: TEXT_SECONDARY,
        });
      }

      y -= LINE_HEIGHT;
    }

    // ── Disclaimer Footer ────────────────────────────────────────
    y -= 20;
    ensureSpace(60);

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: TEXT_MUTED,
    });
    y -= 14;

    const disclaimerLines = wrapText(
      "DISCLAIMER: This report is generated by AutiSense, an AI-assisted autism screening tool. " +
        "It is NOT a clinical diagnosis. Autism spectrum disorder can only be diagnosed by qualified " +
        "healthcare professionals through comprehensive evaluation using standardized diagnostic " +
        "instruments (e.g., ADOS-2, ADI-R). This screening report is intended to support, not " +
        "replace, clinical judgment. Please share this report with a developmental pediatrician " +
        "or autism specialist for professional interpretation.",
      helvetica,
      8,
      CONTENT_WIDTH,
    );

    for (const dLine of disclaimerLines) {
      ensureSpace(12);
      page.drawText(dLine, {
        x: MARGIN,
        y,
        size: 8,
        font: helvetica,
        color: TEXT_MUTED,
      });
      y -= 11;
    }

    // ── Finalize ─────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="AutiSense_Report_${sessionDate.replace(/\//g, "-")}.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (err) {
    console.error("[Report/PDF] PDF generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
