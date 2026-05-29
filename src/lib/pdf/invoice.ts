import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";

const PAGE = { margin: 50 };
const COLOR = {
  text: "#1f2933",
  muted: "#6b7280",
  border: "#d1d5db",
  brand: "#f5851f", // AiTek orange
  light: "#f4f5f7",
};

const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

/** Generate a professional invoice PDF and resolve to a Buffer. */
export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, items: true },
  });
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found.`);
  }

  const settings = await getSettings();
  const currency = invoice.currency;

  const doc = new PDFDocument({ size: "A4", margin: PAGE.margin });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const contentWidth = pageRight - pageLeft;

  // --- Header: logo / company + INVOICE title -----------------------------
  let companyY = PAGE.margin;
  let logoDrawn = false;
  // Prefer the bundled logo; fall back to the company name as text.
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const logoWidth = 150;
      doc.image(LOGO_PATH, pageLeft, PAGE.margin, { width: logoWidth });
      // logo aspect ratio is 946x282
      companyY = PAGE.margin + Math.round((logoWidth * 282) / 946) + 8;
      logoDrawn = true;
    }
  } catch {
    logoDrawn = false;
  }

  if (!logoDrawn) {
    doc
      .fillColor(COLOR.text)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(settings.companyName, pageLeft, PAGE.margin, {
        width: contentWidth / 2,
      });
    companyY = doc.y + 4;
  }

  doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted);
  if (settings.companyAddress) {
    doc.text(settings.companyAddress, pageLeft, companyY, { width: contentWidth / 2 });
    companyY = doc.y;
  }
  if (settings.companyEmail) {
    doc.text(settings.companyEmail, pageLeft, companyY, { width: contentWidth / 2 });
  }
  if (settings.companyPhone) {
    doc.text(settings.companyPhone, pageLeft, doc.y, { width: contentWidth / 2 });
  }

  // INVOICE title + meta on the right
  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor(COLOR.brand)
    .text("INVOICE", pageLeft, PAGE.margin, {
      width: contentWidth,
      align: "right",
    });

  doc.font("Helvetica").fontSize(10).fillColor(COLOR.text);
  const metaY = doc.y + 6;
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageLeft, metaY, {
    width: contentWidth,
    align: "right",
  });
  doc.text(`Date: ${formatDate(invoice.createdAt)}`, {
    width: contentWidth,
    align: "right",
  });
  doc.text(`Due: ${formatDate(invoice.dueDate)}`, {
    width: contentWidth,
    align: "right",
  });
  doc.text(`Status: ${invoice.status}`, {
    width: contentWidth,
    align: "right",
  });

  // --- Bill To ------------------------------------------------------------
  const billToY = Math.max(doc.y, companyY) + 24;
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLOR.muted)
    .text("BILL TO", pageLeft, billToY);

  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.text);
  doc.text(invoice.client.name, pageLeft, doc.y + 2);
  doc.font("Helvetica").fontSize(10).fillColor(COLOR.muted);
  if (invoice.client.company) doc.text(invoice.client.company);
  if (invoice.client.email) doc.text(invoice.client.email);
  if (invoice.client.address) doc.text(invoice.client.address, { width: contentWidth / 2 });

  // --- Items table --------------------------------------------------------
  let tableTop = doc.y + 28;

  // Column layout
  const colDesc = pageLeft;
  const colQty = pageLeft + contentWidth * 0.55;
  const colUnit = pageLeft + contentWidth * 0.68;
  const colTotal = pageLeft + contentWidth * 0.84;
  const colEnd = pageRight;

  const drawHeader = (y: number) => {
    doc.rect(pageLeft, y - 4, contentWidth, 22).fill(COLOR.light);
    doc.fillColor(COLOR.muted).font("Helvetica-Bold").fontSize(9);
    doc.text("DESCRIPTION", colDesc + 6, y + 2, { width: colQty - colDesc - 8 });
    doc.text("QTY", colQty, y + 2, { width: colUnit - colQty - 6, align: "right" });
    doc.text("UNIT PRICE", colUnit, y + 2, {
      width: colTotal - colUnit - 6,
      align: "right",
    });
    doc.text("TOTAL", colTotal, y + 2, {
      width: colEnd - colTotal - 6,
      align: "right",
    });
  };

  drawHeader(tableTop);
  let rowY = tableTop + 24;

  doc.font("Helvetica").fontSize(10).fillColor(COLOR.text);
  for (const item of invoice.items) {
    // Page break guard
    if (rowY > doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage();
      rowY = doc.page.margins.top;
      drawHeader(rowY);
      rowY += 24;
    }

    const descHeight = doc.heightOfString(item.description, {
      width: colQty - colDesc - 12,
    });
    const rowHeight = Math.max(descHeight, 14) + 8;

    doc.fillColor(COLOR.text).font("Helvetica").fontSize(10);
    doc.text(item.description, colDesc + 6, rowY, { width: colQty - colDesc - 12 });
    doc.text(String(item.quantity), colQty, rowY, {
      width: colUnit - colQty - 6,
      align: "right",
    });
    doc.text(formatCurrency(item.unitPrice, currency), colUnit, rowY, {
      width: colTotal - colUnit - 6,
      align: "right",
    });
    doc.text(formatCurrency(item.total, currency), colTotal, rowY, {
      width: colEnd - colTotal - 6,
      align: "right",
    });

    rowY += rowHeight;
    doc
      .strokeColor(COLOR.border)
      .lineWidth(0.5)
      .moveTo(pageLeft, rowY - 4)
      .lineTo(pageRight, rowY - 4)
      .stroke();
  }

  // --- Totals -------------------------------------------------------------
  const totalsX = pageLeft + contentWidth * 0.6;
  const totalsWidth = pageRight - totalsX;
  let totalsY = rowY + 12;

  const totalRow = (label: string, value: string, bold = false) => {
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(bold ? 12 : 10)
      .fillColor(COLOR.text);
    doc.text(label, totalsX, totalsY, { width: totalsWidth * 0.5 });
    doc.text(value, totalsX + totalsWidth * 0.5, totalsY, {
      width: totalsWidth * 0.5,
      align: "right",
    });
    totalsY = doc.y + 4;
  };

  totalRow("Subtotal", formatCurrency(invoice.subtotal, currency));
  const taxRate = toNumber(invoice.taxRate);
  totalRow(`Tax (${taxRate}%)`, formatCurrency(invoice.tax, currency));
  doc
    .strokeColor(COLOR.border)
    .lineWidth(0.5)
    .moveTo(totalsX, totalsY)
    .lineTo(pageRight, totalsY)
    .stroke();
  totalsY += 6;
  totalRow("Total", formatCurrency(invoice.total, currency), true);

  // --- Payment instructions ----------------------------------------------
  let payY = totalsY + 30;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.text);
  doc.text("Payment", pageLeft, payY);
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted);
  doc.text(
    `Please settle this invoice by ${formatDate(invoice.dueDate)}.`,
    pageLeft,
    doc.y + 2,
    { width: contentWidth }
  );
  if (invoice.stripePaymentLinkUrl) {
    doc.fillColor(COLOR.brand);
    doc.text("Pay online: ", pageLeft, doc.y + 4, { continued: true });
    doc.text(invoice.stripePaymentLinkUrl, {
      link: invoice.stripePaymentLinkUrl,
      underline: true,
    });
    doc.fillColor(COLOR.muted);
  }

  if (invoice.notes) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.text);
    doc.text("Notes", pageLeft, doc.y + 14);
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted);
    doc.text(invoice.notes, pageLeft, doc.y + 2, { width: contentWidth });
  }

  // --- Footer -------------------------------------------------------------
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLOR.muted)
    .text(
      `Thank you for your business — ${settings.companyName}`,
      pageLeft,
      doc.page.height - doc.page.margins.bottom - 20,
      { width: contentWidth, align: "center" }
    );

  doc.end();
  return done;
}
