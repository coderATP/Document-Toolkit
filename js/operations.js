/* =========================================================
   PDF EDITOR
   PDF operations
========================================================= */

class PdfOperations {
  
  constructor(app) {
    this.app = app;
  }
  
  get document() {
    return this.app.document;
  }
  
  /* =====================================================
     MERGE
  ===================================================== */
  
  async merge(files) {
    if (!files || files.length < 2) {
      throw new Error(
        "Add at least two PDF files."
      );
    }
    
    this.app.ui.showLoading("Merging PDFs...");
    
    try {
      const mergedPdf =
        await PDFLib.PDFDocument.create();
      
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        
        const sourcePdf =
          await PDFLib.PDFDocument.load(bytes);
        
        const copiedPages =
          await mergedPdf.copyPages(
            sourcePdf,
            sourcePdf.getPageIndices()
          );
        
        copiedPages.forEach(function(page) {
          mergedPdf.addPage(page);
        });
      }
      
      const mergedBytes = await mergedPdf.save();
      
      PdfUtils.createDownload(
        mergedBytes,
        "merged.pdf"
      );
      
      this.app.ui.setStatus("PDFs merged");
      
    } finally {
      this.app.ui.hideLoading();
    }
  }
  
  /* =====================================================
     EXTRACT
  ===================================================== */
  
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
      const sourcePdf =
        await PDFLib.PDFDocument.load(
          this.document.workingBytes
        );
      
      const outputPdf =
        await PDFLib.PDFDocument.create();
      
      const pages = await outputPdf.copyPages(
        sourcePdf,
        pageIndexes
      );
      
      pages.forEach(function(page) {
        outputPdf.addPage(page);
      });
      
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
  
  /* =====================================================
     ROTATE
  ===================================================== */
  
  async rotate(direction) {
    const pageIndex = this.document.currentPage - 1;
    
    await this.modifyCurrentDocument(
      "Rotating page...",
      async function(pdf) {
        const page = pdf.getPage(pageIndex);
        
        const currentRotation =
          page.getRotation().angle;
        
        const newRotation =
          (currentRotation + direction + 360) % 360;
        
        page.setRotation(
          PDFLib.degrees(newRotation)
        );
      }
    );
    
    this.app.ui.setStatus("Page rotated");
  }
  
  /* =====================================================
     DELETE
  ===================================================== */
  
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
    
    this.app.ui.setStatus("Page deleted");
  }
  
  /* =====================================================
     REORDER
  ===================================================== */
  
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
      const sourcePdf =
        await PDFLib.PDFDocument.load(
          this.document.workingBytes
        );
      
      const outputPdf =
        await PDFLib.PDFDocument.create();
      
      const pageIndexes = sourcePdf.getPageIndices();
      
      const temporary = pageIndexes[currentIndex];
      
      pageIndexes[currentIndex] = pageIndexes[targetIndex];
      pageIndexes[targetIndex] = temporary;
      
      const copiedPages = await outputPdf.copyPages(
        sourcePdf,
        pageIndexes
      );
      
      copiedPages.forEach(function(page) {
        outputPdf.addPage(page);
      });
      
      const outputBytes = await outputPdf.save();
      
      await this.applyModifiedBytes(
        outputBytes,
        targetIndex + 1
      );
      
      this.app.ui.setStatus("Pages reordered");
      
    } finally {
      this.app.ui.hideLoading();
    }
  }
  
  /* =====================================================
     COMMON MODIFICATION HANDLER
  ===================================================== */
  
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
  
  /* =====================================================
     DOWNLOAD
  ===================================================== */
  
  downloadCurrentDocument() {
    if (!this.document.hasDocument) {
      return;
    }
    
    const name = PdfUtils.getSafeFilename(
      this.document.fileName
    );
    
    PdfUtils.createDownload(
      this.document.workingBytes,
      name + "-edited.pdf"
    );
    
    this.app.ui.setStatus("Download started");
  }
  
}