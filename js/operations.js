import { PdfUtils } from "./config.js";

export class PdfOperations {

    constructor(app) {
        this.app = app;
    }

    get document() {
        return this.app.document;
    }

    async merge(files) {
        if (!files || files.length < 2) {
            throw new Error("Add at least two PDF files.");
        }

        this.app.ui.showLoading("Merging PDFs...");

        try {
            const mergedPdf = await PDFLib.PDFDocument.create();

            for (const file of files) {
                const bytes = await file.arrayBuffer();
                const sourcePdf = await PDFLib.PDFDocument.load(bytes);

                const copiedPages = await mergedPdf.copyPages(
                    sourcePdf,
                    sourcePdf.getPageIndices()
                );

                copiedPages.forEach(page => mergedPdf.addPage(page));
            }

            const mergedBytes = await mergedPdf.save();

            PdfUtils.createDownload(mergedBytes, "merged.pdf");
            this.app.ui.setStatus("PDFs merged");

        } finally {
            this.app.ui.hideLoading();
        }
    }

    async extract(rangeText) {
        if (!this.document.hasDocument) {
            throw new Error("Open a PDF first.");
        }

        const pageIndexes = PdfUtils.parsePageRanges(
            rangeText,
            this.document.totalPages
        );

        this.app.ui.showLoading("Extracting pages...");

        try {
            const sourcePdf = await PDFLib.PDFDocument.load(
                this.document.workingBytes
            );

            const outputPdf = await PDFLib.PDFDocument.create();

            const pages = await outputPdf.copyPages(
                sourcePdf,
                pageIndexes
            );

            pages.forEach(page => outputPdf.addPage(page));

            const outputBytes = await outputPdf.save();

            const baseName = PdfUtils.getSafeFilename(
                this.document.fileName
            );

            PdfUtils.createDownload(
                outputBytes,
                baseName + "-extracted.pdf"
            );

            this.app.ui.setStatus("Pages extracted");

        } finally {
            this.app.ui.hideLoading();
        }
    }

    async rotate(direction) {
        const pageIndex = this.document.currentPage - 1;

        await this.modifyCurrentDocument(
            "Rotating page...",
            async function(pdf) {
                const page = pdf.getPage(pageIndex);

                const currentRotation = page.getRotation().angle;

                const newRotation =
                    (currentRotation + direction + 360) % 360;

                page.setRotation(PDFLib.degrees(newRotation));
            }
        );

        this.app.ui.setStatus("Page rotated");
    }

    async deleteCurrentPage() {
        if (this.document.totalPages <= 1) {
            throw new Error(
                "A PDF must contain at least one page."
            );
        }

        const pageIndex = this.document.currentPage - 1;

        await this.modifyCurrentDocument(
            "Deleting page...",
            async function(pdf) {
                pdf.removePage(pageIndex);
            }
        );

        this.app.annotations.deletePageAndShift(pageIndex + 1);

        this.app.annotations.syncLayer(
            this.document.currentPage,
            this.app.renderer.currentViewport
        );

        this.app.ui.setStatus("Page deleted");
    }

    async moveCurrentPage(direction) {
        const currentIndex = this.document.currentPage - 1;
        const targetIndex = currentIndex + direction;

        if (
            targetIndex < 0 ||
            targetIndex >= this.document.totalPages
        ) {
            return;
        }

        this.app.ui.showLoading("Reordering pages...");

        try {
            const sourcePdf = await PDFLib.PDFDocument.load(
                this.document.workingBytes
            );

            const outputPdf = await PDFLib.PDFDocument.create();

            const pageIndexes = sourcePdf.getPageIndices();

            const temporary = pageIndexes[currentIndex];

            pageIndexes[currentIndex] = pageIndexes[targetIndex];
            pageIndexes[targetIndex] = temporary;

            const copiedPages = await outputPdf.copyPages(
                sourcePdf,
                pageIndexes
            );

            copiedPages.forEach(page => outputPdf.addPage(page));

            const outputBytes = await outputPdf.save();

            await this.applyModifiedBytes(
                outputBytes,
                targetIndex + 1
            );

            this.app.annotations.movePage(
                currentIndex + 1,
                targetIndex + 1
            );

            this.app.annotations.syncLayer(
                this.document.currentPage,
                this.app.renderer.currentViewport
            );

            this.app.ui.setStatus("Pages reordered");

        } finally {
            this.app.ui.hideLoading();
        }
    }

    async modifyCurrentDocument(message, modification) {
        if (!this.document.hasDocument) {
            throw new Error("Open a PDF first.");
        }

        this.app.ui.showLoading(message);

        try {
            const pdf = await PDFLib.PDFDocument.load(
                this.document.workingBytes
            );

            await modification(pdf);

            const bytes = await pdf.save();

            await this.applyModifiedBytes(
                bytes,
                this.document.currentPage
            );

        } finally {
            this.app.ui.hideLoading();
        }
    }

    async applyModifiedBytes(bytes, preferredPage) {
        const pdf = await PDFLib.PDFDocument.load(bytes);
        const totalPages = pdf.getPageCount();

        const pageNumber = Math.min(
            Math.max(1, preferredPage),
            totalPages
        );

        await this.document.reloadWorkingDocument(bytes);
        await this.document.goToPage(pageNumber);

        this.app.ui.updateControls();
    }

    getPdfColor(value, fallback) {
        if (
            typeof value !== "string" ||
            !/^#[0-9a-f]{6}$/i.test(value)
        ) {
            value = fallback;
        }

        const hex = value.substring(1);

        return PDFLib.rgb(
            parseInt(hex.substring(0, 2), 16) / 255,
            parseInt(hex.substring(2, 4), 16) / 255,
            parseInt(hex.substring(4, 6), 16) / 255
        );
    }

    wrapText(text, font, fontSize, maxWidth) {
        const paragraphs = text.split(/\r\n|\r|\n/);
        const lines = [];

        paragraphs.forEach(paragraph => {
            if (paragraph.length === 0) {
                lines.push("");
                return;
            }

            if (!maxWidth || maxWidth <= 0) {
                lines.push(paragraph);
                return;
            }

            const words = paragraph.split(" ");
            let currentLine = "";

            words.forEach(word => {
                const candidate = currentLine
                    ? currentLine + " " + word
                    : word;

                const candidateWidth =
                    font.widthOfTextAtSize(candidate, fontSize);

                if (currentLine && candidateWidth > maxWidth) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = candidate;
                }
            });

            lines.push(currentLine);
        });

        return lines;
    }

    drawHighlight(page, annotation) {
        const highlightColor = this.getPdfColor(
            annotation.color,
            "#ffeb3b"
        );

        const opacity = Math.max(
            0,
            Math.min(1, Number(annotation.opacity ?? 0.7))
        );

        for (const rectangle of annotation.rectangles || []) {
            page.drawRectangle({
                x: rectangle.x,
                y: rectangle.y,
                width: rectangle.width,
                height: rectangle.height,
                color: highlightColor,
                opacity: opacity,
                borderWidth: 0
            });
        }
    }

    drawFreehand(page, annotation) {
        const points = annotation.points || [];

        if (points.length < 2) {
            return;
        }

        const color = this.getPdfColor(
            annotation.color,
            "#123B78"
        );

        const thickness = Math.max(
            0.1,
            Number(annotation.thickness) || 3
        );

        const opacity = Math.max(
            0,
            Math.min(1, Number(annotation.opacity ?? 1))
        );

        for (let index = 1; index < points.length; index++) {
            const start = points[index - 1];
            const end = points[index];

            page.drawLine({
                start: {
                    x: start.x,
                    y: start.y
                },
                end: {
                    x: end.x,
                    y: end.y
                },
                thickness: thickness,
                color: color,
                opacity: opacity
            });
        }
    }

    async downloadCurrentDocument() {
        if (!this.document.hasDocument) {
            return;
        }

        this.app.ui.showLoading("Preparing PDF...");

        try {
            if (this.app.annotations.selectedId) {
                this.app.annotations.finalizeSelectedAnnotation();
            }

            const pdf = await PDFLib.PDFDocument.load(
                this.document.workingBytes
            );

            const annotations =
                this.app.annotations.getAllAnnotations();

            const regularFont = await pdf.embedFont(
                PDFLib.StandardFonts.Helvetica
            );

            const boldFont = await pdf.embedFont(
                PDFLib.StandardFonts.HelveticaBold
            );

            const italicFont = await pdf.embedFont(
                PDFLib.StandardFonts.HelveticaOblique
            );

            const boldItalicFont = await pdf.embedFont(
                PDFLib.StandardFonts.HelveticaBoldOblique
            );

            for (const annotation of annotations) {
                const pageIndex = annotation.pageNumber - 1;

                if (
                    pageIndex < 0 ||
                    pageIndex >= pdf.getPageCount()
                ) {
                    continue;
                }

                const page = pdf.getPage(pageIndex);

                if (annotation.type === "highlight") {
                    this.drawHighlight(page, annotation);
                    continue;
                }

                if (annotation.type === "drawing") {
                    this.drawFreehand(page, annotation);
                    continue;
                }

                if (annotation.type !== "text") {
                    continue;
                }

                const fontSize =
                    Number(annotation.fontSize) || 12;

                const rotation =
                    Number(annotation.rotation) || 0;

                const pdfRotation = -rotation;

                let font = regularFont;

                if (annotation.bold && annotation.italic) {
                    font = boldItalicFont;
                } else if (annotation.bold) {
                    font = boldFont;
                } else if (annotation.italic) {
                    font = italicFont;
                }

                const text = String(annotation.text || "");

                if (!text.trim()) {
                    continue;
                }

                const textColor = this.getPdfColor(
                    annotation.color,
                    "#000000"
                );

                const backgroundColor =
                    annotation.backgroundColor;

                const hasBackground =
                    typeof backgroundColor === "string" &&
                    /^#[0-9a-f]{6}$/i.test(backgroundColor);

                const fillColor = hasBackground
                    ? this.getPdfColor(backgroundColor, "#FFFFFF")
                    : null;

                const maxWidth =
                    Number.isFinite(Number(annotation.width)) &&
                    annotation.width !== null &&
                    Number(annotation.width) > 0
                        ? Number(annotation.width)
                        : null;

                const lines = this.wrapText(
                    text,
                    font,
                    fontSize,
                    maxWidth
                );

                const lineHeight = fontSize * 1.2;

                let measuredWidth = 0;

                lines.forEach(line => {
                    const lineWidth = font.widthOfTextAtSize(
                        line,
                        fontSize
                    );

                    measuredWidth = Math.max(
                        measuredWidth,
                        lineWidth
                    );
                });

                const boxWidth = maxWidth || measuredWidth;

                const boxHeight =
                    Number.isFinite(Number(annotation.height)) &&
                    annotation.height !== null &&
                    Number(annotation.height) > 0
                        ? Number(annotation.height)
                        : lines.length * lineHeight;

                const boxBottom =
                    annotation.y + fontSize - boxHeight;

                const boxCenterX =
                    annotation.x + boxWidth / 2;

                const boxCenterY =
                    boxBottom + boxHeight / 2;

                page.pushOperators(
                    PDFLib.pushGraphicsState(),
                    PDFLib.translate(boxCenterX, boxCenterY),
                    PDFLib.rotateDegrees(pdfRotation),
                    PDFLib.translate(-boxCenterX, -boxCenterY)
                );

                if (hasBackground) {
                    page.drawRectangle({
                        x: annotation.x,
                        y: boxBottom,
                        width: boxWidth,
                        height: boxHeight,
                        color: fillColor
                    });
                }

                lines.forEach((line, index) => {
                    const lineY =
                        annotation.y - index * lineHeight;

                    const lineWidth = font.widthOfTextAtSize(
                        line,
                        fontSize
                    );

                    page.drawText(line, {
                        x: annotation.x,
                        y: lineY,
                        size: fontSize,
                        font: font,
                        color: textColor
                    });

                    const decorationLines = [];

                    if (annotation.underline) {
                        decorationLines.push({
                            offset: fontSize * 0.12,
                            position: "below",
                            width: 1
                        });
                    }

                    if (annotation.strikethrough) {
                        decorationLines.push({
                            offset: fontSize * 0.30,
                            position: "above",
                            width: 1
                        });
                    }

                    if (annotation.doubleStrikethrough) {
                        decorationLines.push({
                            offset: fontSize * 0.30,
                            position: "above",
                            width: 1
                        });

                        decorationLines.push({
                            offset: fontSize * 0.43,
                            position: "above",
                            width: 1
                        });
                    }

                    decorationLines.forEach(decoration => {
                        const decorationY =
                            decoration.position === "above"
                                ? lineY + decoration.offset
                                : lineY - decoration.offset;

                        page.drawLine({
                            start: {
                                x: annotation.x,
                                y: decorationY
                            },
                            end: {
                                x: annotation.x + lineWidth,
                                y: decorationY
                            },
                            thickness: decoration.width,
                            color: textColor
                        });
                    });
                });

                page.pushOperators(
                    PDFLib.popGraphicsState()
                );
            }

            const outputBytes = await pdf.save();

            const name = PdfUtils.getSafeFilename(
                this.document.fileName
            );

            PdfUtils.createDownload(
                outputBytes,
                name + "-edited.pdf"
            );

            this.app.ui.setStatus("Download started");

        } finally {
            this.app.ui.hideLoading();
        }
    }
}