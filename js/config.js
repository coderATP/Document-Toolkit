
pdfjsLib.GlobalWorkerOptions.workerSrc =
    "vendor/pdfjs/pdf.worker.min.js";

export const PDF_CONFIG = {
    renderScale: 1.5,
    thumbnailScale: 0.25,

    minimumZoom: 0.25,
    maximumZoom: 3,
    zoomStep: 0.15
};

export class PdfUtils {

    static formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }

        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + " KB";
        }

        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    static getFileNameWithoutExtension(name) {
        return name.replace(/\.pdf$/i, "");
    }

    static getSafeFilename(name) {
        return name
            .replace(/\.pdf$/i, "")
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    }

    static createDownload(bytes, filename) {
        const blob = new Blob(
            [bytes],
            { type: "application/pdf" }
        );

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = filename;

        document.body.appendChild(anchor);

        anchor.click();
        anchor.remove();

        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    static parsePageRanges(value, totalPages) {
        const result = new Set();

        const parts = value
            .split(",")
            .map(function (part) {
                return part.trim();
            })
            .filter(Boolean);

        if (parts.length === 0) {
            throw new Error("Enter the pages to extract.");
        }

        for (const part of parts) {
            const rangeMatch = part.match(
                /^(\d+)\s*-\s*(\d+)$/
            );

            const singleMatch = part.match(/^\d+$/);

            if (rangeMatch) {
                const start = Number(rangeMatch[1]);
                const end = Number(rangeMatch[2]);

                if (
                    start < 1 ||
                    end < 1 ||
                    start > totalPages ||
                    end > totalPages ||
                    start > end
                ) {
                    throw new Error(
                        "Invalid page range: " + part
                    );
                }

                for (
                    let page = start;
                    page <= end;
                    page++
                ) {
                    result.add(page - 1);
                }

            } else if (singleMatch) {
                const page = Number(part);

                if (page < 1 || page > totalPages) {
                    throw new Error(
                        "Page " + page + " does not exist."
                    );
                }

                result.add(page - 1);

            } else {
                throw new Error(
                    "Invalid page format: " + part
                );
            }
        }

        return Array.from(result).sort(function (a, b) {
            return a - b;
        });
    }
}
