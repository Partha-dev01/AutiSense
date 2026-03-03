/**
 * POST /api/report/pdf
 *
 * Generates a downloadable PDF clinical report using pdf-lib.
 * The PDF includes an AutiSense branded header, child information,
 * visual score bars, risk level indicator, the full report text,
 * and a professional disclaimer footer.
 *
 * Request body:
 *   {
 *     report: string,
 *     childName: string,
 *     sessionDate: string,
 *     scores: { gaze: number, motor: number, vocal: number, overall: number },
 *     childAge?: number,            // months
 *     assessmentDuration?: number,   // minutes
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
  childAge?: number;
  assessmentDuration?: number;
}

// AutiSense brand palette
const SAGE_600 = rgb(55 / 255, 102 / 255, 65 / 255);
const SAGE_500 = rgb(77 / 255, 128 / 255, 88 / 255);
const SAGE_300 = rgb(140 / 255, 180 / 255, 148 / 255);
const _SAGE_100 = rgb(227 / 255, 237 / 255, 230 / 255);
const SAGE_50 = rgb(240 / 255, 247 / 255, 242 / 255);
const TEXT_PRIMARY = rgb(45 / 255, 58 / 255, 48 / 255);
const TEXT_SECONDARY = rgb(90 / 255, 112 / 255, 96 / 255);
const TEXT_MUTED = rgb(140 / 255, 156 / 255, 143 / 255);
const WHITE = rgb(1, 1, 1);
const PEACH_400 = rgb(220 / 255, 120 / 255, 80 / 255);
const AMBER_400 = rgb(200 / 255, 170 / 255, 50 / 255);
const BAR_BG = rgb(230 / 255, 235 / 255, 232 / 255);

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

function getRiskLevel(overall: number): { label: string; color: ReturnType<typeof rgb> } {
  if (overall >= 70) return { label: "Low Risk", color: SAGE_500 };
  if (overall >= 40) return { label: "Moderate Risk", color: AMBER_400 };
  return { label: "Elevated Risk", color: PEACH_400 };
}

function formatAge(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} month${rem !== 1 ? "s" : ""}`;
  if (rem === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years}y ${rem}m`;
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

  const { report, childName, sessionDate, scores, childAge, assessmentDuration } = body;

  try {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const PAGE_WIDTH = 595.28; // A4
    const PAGE_HEIGHT = 841.89;
    const MARGIN = 50;
    const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;
    let pageNum = 1;

    /**
     * Draws the page footer with page number and branding.
     */
    function drawFooter() {
      const footerY = 30;
      page.drawLine({
        start: { x: MARGIN, y: footerY + 14 },
        end: { x: PAGE_WIDTH - MARGIN, y: footerY + 14 },
        thickness: 0.5,
        color: SAGE_300,
      });
      page.drawText("AutiSense Developmental Screening Platform", {
        x: MARGIN,
        y: footerY,
        size: 7,
        font: helvetica,
        color: TEXT_MUTED,
      });
      page.drawText(`Page ${pageNum}`, {
        x: PAGE_WIDTH - MARGIN - 30,
        y: footerY,
        size: 7,
        font: helvetica,
        color: TEXT_MUTED,
      });
    }

    /**
     * Adds a new page and resets the y-cursor.
     */
    function addNewPage() {
      drawFooter();
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNum++;
      y = PAGE_HEIGHT - MARGIN;
    }

    /**
     * Ensures enough space remains on the current page;
     * creates a new page if not.
     */
    function ensureSpace(needed: number) {
      if (y - needed < MARGIN + 50) {
        addNewPage();
      }
    }

    // ── Header: green accent bar ────────────────────────────────
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 85,
      width: PAGE_WIDTH,
      height: 85,
      color: SAGE_500,
    });

    // Subtle accent stripe at bottom of header
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 89,
      width: PAGE_WIDTH,
      height: 4,
      color: SAGE_600,
    });

    page.drawText("AutiSense", {
      x: MARGIN,
      y: PAGE_HEIGHT - 35,
      size: 24,
      font: helveticaBold,
      color: WHITE,
    });

    page.drawText("Developmental Screening Report", {
      x: MARGIN,
      y: PAGE_HEIGHT - 55,
      size: 11,
      font: helvetica,
      color: rgb(0.92, 0.96, 0.93),
    });

    page.drawText(`Report Date: ${new Date().toLocaleDateString("en-GB")}`, {
      x: PAGE_WIDTH - MARGIN - 140,
      y: PAGE_HEIGHT - 35,
      size: 9,
      font: helvetica,
      color: rgb(0.88, 0.93, 0.89),
    });

    page.drawText(`Ref: AS-${Date.now().toString(36).toUpperCase()}`, {
      x: PAGE_WIDTH - MARGIN - 140,
      y: PAGE_HEIGHT - 50,
      size: 8,
      font: helvetica,
      color: rgb(0.82, 0.88, 0.84),
    });

    y = PAGE_HEIGHT - 115;

    // ── Child Info Section (2×2 grid) ──────────────────────────
    const infoBoxHeight = 64;
    page.drawRectangle({
      x: MARGIN,
      y: y - infoBoxHeight,
      width: CONTENT_WIDTH,
      height: infoBoxHeight,
      color: SAGE_50,
      borderColor: SAGE_300,
      borderWidth: 1,
    });

    // Left accent bar
    page.drawRectangle({
      x: MARGIN,
      y: y - infoBoxHeight,
      width: 4,
      height: infoBoxHeight,
      color: SAGE_500,
    });

    page.drawText("CHILD INFORMATION", {
      x: MARGIN + 14,
      y: y - 15,
      size: 8,
      font: helveticaBold,
      color: SAGE_600,
    });

    // Row 1
    page.drawText(`Name: ${childName}`, {
      x: MARGIN + 14,
      y: y - 32,
      size: 10,
      font: helvetica,
      color: TEXT_PRIMARY,
    });

    page.drawText(`Session Date: ${sessionDate}`, {
      x: MARGIN + CONTENT_WIDTH / 2,
      y: y - 32,
      size: 10,
      font: helvetica,
      color: TEXT_PRIMARY,
    });

    // Row 2
    page.drawText(`Age: ${childAge ? formatAge(childAge) : "Not specified"}`, {
      x: MARGIN + 14,
      y: y - 50,
      size: 10,
      font: helvetica,
      color: TEXT_PRIMARY,
    });

    page.drawText(`Duration: ${assessmentDuration ? `${assessmentDuration} min` : "N/A"}`, {
      x: MARGIN + CONTENT_WIDTH / 2,
      y: y - 50,
      size: 10,
      font: helvetica,
      color: TEXT_PRIMARY,
    });

    y -= infoBoxHeight + 24;

    // ── Visual Score Bars ──────────────────────────────────────
    ensureSpace(160);

    page.drawText("ASSESSMENT SCORES", {
      x: MARGIN,
      y,
      size: 10,
      font: helveticaBold,
      color: SAGE_600,
    });
    y -= 8;

    // Thin accent line under heading
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + 130, y },
      thickness: 2,
      color: SAGE_500,
    });
    y -= 18;

    const scoreItems = [
      { label: "Gaze Tracking", value: scores.gaze, isPercent: true },
      { label: "Motor Coordination", value: scores.motor, isPercent: true },
      { label: "Vocalization Quality", value: scores.vocal, isPercent: true },
    ];

    const BAR_WIDTH = CONTENT_WIDTH - 140;
    const BAR_HEIGHT = 14;

    for (const item of scoreItems) {
      ensureSpace(30);

      const pct = item.value * 100;
      const displayVal = `${pct.toFixed(0)}%`;
      const barColor = pct >= 60 ? SAGE_500 : pct >= 35 ? AMBER_400 : PEACH_400;

      // Label
      page.drawText(item.label, {
        x: MARGIN,
        y: y - 2,
        size: 9.5,
        font: helvetica,
        color: TEXT_PRIMARY,
      });

      // Value text
      page.drawText(displayVal, {
        x: MARGIN + 110,
        y: y - 2,
        size: 9.5,
        font: helveticaBold,
        color: TEXT_PRIMARY,
      });

      // Background bar
      const barX = MARGIN + 140;
      page.drawRectangle({
        x: barX,
        y: y - 5,
        width: BAR_WIDTH,
        height: BAR_HEIGHT,
        color: BAR_BG,
        borderColor: SAGE_300,
        borderWidth: 0.5,
      });

      // Filled portion
      const fillWidth = Math.max(2, (pct / 100) * BAR_WIDTH);
      page.drawRectangle({
        x: barX,
        y: y - 5,
        width: fillWidth,
        height: BAR_HEIGHT,
        color: barColor,
      });

      y -= 28;
    }

    // ── Overall Score + Risk Level ─────────────────────────────
    y -= 6;
    ensureSpace(50);

    const risk = getRiskLevel(scores.overall);
    const overallBoxWidth = CONTENT_WIDTH;

    page.drawRectangle({
      x: MARGIN,
      y: y - 40,
      width: overallBoxWidth,
      height: 40,
      color: SAGE_50,
      borderColor: SAGE_300,
      borderWidth: 1,
    });

    page.drawText(`Overall Score: ${scores.overall}/100`, {
      x: MARGIN + 14,
      y: y - 26,
      size: 12,
      font: helveticaBold,
      color: TEXT_PRIMARY,
    });

    // Risk badge
    const badgeWidth = helveticaBold.widthOfTextAtSize(risk.label, 10) + 20;
    const badgeX = PAGE_WIDTH - MARGIN - badgeWidth - 14;
    page.drawRectangle({
      x: badgeX,
      y: y - 32,
      width: badgeWidth,
      height: 22,
      color: risk.color,
    });
    page.drawText(risk.label, {
      x: badgeX + 10,
      y: y - 25,
      size: 10,
      font: helveticaBold,
      color: WHITE,
    });

    y -= 60;

    // ── Methodology Note ──────────────────────────────────────
    ensureSpace(40);
    page.drawText("Methodology", {
      x: MARGIN,
      y,
      size: 8,
      font: helveticaBold,
      color: TEXT_MUTED,
    });
    y -= 12;

    const methodLines = wrapText(
      "Scores are derived from computer-assisted behavioral observation during structured screening tasks. " +
      "Gaze tracking uses MediaPipe face mesh analysis, motor coordination uses YOLO pose estimation, " +
      "and vocalization quality is assessed through Web Speech API response analysis. " +
      "All processing occurs locally on the user's device.",
      helveticaOblique,
      7.5,
      CONTENT_WIDTH,
    );

    for (const mLine of methodLines) {
      page.drawText(mLine, {
        x: MARGIN,
        y,
        size: 7.5,
        font: helveticaOblique,
        color: TEXT_MUTED,
      });
      y -= 10;
    }

    y -= 10;

    // ── Full Report Text ─────────────────────────────────────
    ensureSpace(30);

    // Section heading with accent bar
    page.drawRectangle({
      x: MARGIN,
      y: y - 2,
      width: 4,
      height: 18,
      color: SAGE_500,
    });

    page.drawText("CLINICAL SCREENING REPORT", {
      x: MARGIN + 12,
      y,
      size: 12,
      font: helveticaBold,
      color: TEXT_PRIMARY,
    });
    y -= 22;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: SAGE_500,
    });
    y -= 14;

    // Wrap and render report text
    const wrappedLines = wrapText(report, helvetica, 9.5, CONTENT_WIDTH - 10);
    const LINE_HEIGHT = 13;

    for (const line of wrappedLines) {
      ensureSpace(LINE_HEIGHT + 5);

      // Detect section headers
      const isMainHeader =
        /^(CRITERION\s+[AB]|MOTOR\s+DEVELOPMENT|RECOMMENDATION)/i.test(line);
      const isSubHeader =
        /^(Gaze\s+Tracking|Vocalization|Facial\s+Affect|Social\s+Communication|Motor\s+Pattern|Response\s+Latency|Behavior\s+Classification|Behavior\s+Distribution|Overall\s+Screening|Based\s+on\s+this|Note:)/i.test(line);
      const isFlagLine = /Flag:.*(?:FLAGGED|Within)/i.test(line);
      const isBullet = /^\s*[-•]\s/.test(line) || /^\s*\d+\.\s/.test(line);

      if (isMainHeader) {
        y -= 10;
        ensureSpace(LINE_HEIGHT + 14);

        // Accent bar for main headers
        page.drawRectangle({
          x: MARGIN + 4,
          y: y - 3,
          width: 3,
          height: 14,
          color: SAGE_500,
        });

        page.drawText(line, {
          x: MARGIN + 12,
          y,
          size: 10.5,
          font: helveticaBold,
          color: SAGE_600,
        });
      } else if (isSubHeader) {
        y -= 4;
        ensureSpace(LINE_HEIGHT + 6);
        page.drawText(line, {
          x: MARGIN + 4,
          y,
          size: 9.5,
          font: helveticaBold,
          color: TEXT_PRIMARY,
        });
      } else if (isFlagLine) {
        const isFlagged = /FLAGGED/i.test(line);
        page.drawText(line, {
          x: MARGIN + 4,
          y,
          size: 9.5,
          font: helveticaBold,
          color: isFlagged ? PEACH_400 : SAGE_500,
        });
      } else if (isBullet) {
        page.drawText(line, {
          x: MARGIN + 16,
          y,
          size: 9.5,
          font: helvetica,
          color: TEXT_SECONDARY,
        });
      } else if (line === "") {
        // blank line — just spacing
      } else if (line.startsWith("IMPORTANT")) {
        y -= 4;
        page.drawText(line, {
          x: MARGIN + 4,
          y,
          size: 9,
          font: helveticaBold,
          color: TEXT_SECONDARY,
        });
      } else {
        page.drawText(line, {
          x: MARGIN + 4,
          y,
          size: 9.5,
          font: helvetica,
          color: TEXT_SECONDARY,
        });
      }

      y -= LINE_HEIGHT;
    }

    // ── Section separator ─────────────────────────────────────
    y -= 10;
    ensureSpace(20);
    page.drawLine({
      start: { x: MARGIN + 40, y },
      end: { x: PAGE_WIDTH - MARGIN - 40, y },
      thickness: 0.5,
      color: SAGE_300,
    });

    // ── Disclaimer Footer ────────────────────────────────────
    y -= 20;
    ensureSpace(80);

    page.drawRectangle({
      x: MARGIN,
      y: y - 70,
      width: CONTENT_WIDTH,
      height: 70,
      color: SAGE_50,
      borderColor: SAGE_300,
      borderWidth: 0.5,
    });

    page.drawText("IMPORTANT NOTICE", {
      x: MARGIN + 12,
      y: y - 14,
      size: 8,
      font: helveticaBold,
      color: SAGE_600,
    });

    const disclaimerLines = wrapText(
      "This report is generated by AutiSense, a computer-assisted developmental screening tool. " +
        "It is NOT a clinical diagnosis. Autism spectrum disorder can only be diagnosed by qualified " +
        "healthcare professionals through comprehensive evaluation using standardized diagnostic " +
        "instruments (e.g., ADOS-2, ADI-R). This screening report is intended to support, not " +
        "replace, clinical judgment. Please share this report with a developmental paediatrician " +
        "or autism specialist for professional interpretation.",
      helvetica,
      7.5,
      CONTENT_WIDTH - 24,
    );

    let disclaimerY = y - 28;
    for (const dLine of disclaimerLines) {
      page.drawText(dLine, {
        x: MARGIN + 12,
        y: disclaimerY,
        size: 7.5,
        font: helvetica,
        color: TEXT_SECONDARY,
      });
      disclaimerY -= 10;
    }

    // Draw footer on the last page
    drawFooter();

    // ── Finalize ─────────────────────────────────────────────
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
