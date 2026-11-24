
/* =========================================================
   PDF STUDIO — FOUNDATION

   PDF.js handles PDF rendering.
   pdf-lib is loaded for upcoming document operations.

   This milestone includes:
   - Opening PDF files
   - Drag-and-drop PDF opening
   - Page rendering
   - Page thumbnails
   - Page navigation
   - Zoom controls
   - Fit page
   - Downloading the untouched original PDF

   All PDF processing happens locally in the browser.
========================================================= */

(function () {
    "use strict";

    const pdfjsLib = window.pdfjsLib;

    if (!pdfjsLib) {
        alert(
            "PDF.js could not load.\n\n" +
            "Check that this file exists:\n" +
            "vendor/pdfjs/pdf.min.js\n\n" +
            "Also make sure you are running the project through a local web server."
        );

        return;
    }

    // Use the locally stored PDF.js worker.
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "vendor/pdfjs/pdf.worker.min.js";

    const state = {
        pdfDocument: null,
        originalBytes: null,
        fileName: "",
        currentPage: 1,
        scale: 1,
        minScale: 0.4,
        maxScale: 2.5,
        renderTask: null,
        isRendering: false,
        thumbnailTasks: []
    };

    const elements = {
        fileInput: document.getElementById("fileInput"),
        openFileButton: document.getElementById("openFileButton"),
        welcomeOpenButton: document.getElementById("welcomeOpenButton"),
        downloadButton: document.getElementById("downloadButton"),
        documentName: document.getElementById("documentName"),
        pageCount: document.getElementById("pageCount"),
        totalPages: document.getElementById("totalPages"),
        thumbnailList: document.getElementById("thumbnailList"),
        statusText: document.getElementById("statusText"),
        welcomePanel: document.getElementById("welcomePanel"),
        canvasWrap: document.getElementById("canvasWrap"),
        canvas: document.getElementById("pdfCanvas"),
        pageFrame: document.getElementById("pageFrame"),
        pageNumberInput: document.getElementById("pageNumberInput"),
        previousPageButton: document.getElementById("previousPageButton"),
        nextPageButton: document.getElementById("nextPageButton"),
        zoomOutButton: document.getElementById("zoomOutButton"),
        zoomInButton: document.getElementById("zoomInButton"),
        zoomValue: document.getElementById("zoomValue"),
        fitButton: document.getElementById("fitButton"),
        workspace: document.getElementById("workspace"),
        dropOverlay: document.getElementById("dropOverlay")
    };

    const mainContext = elements.canvas.getContext("2d", {
        alpha: false
    });

    /* =====================================================
       GENERAL UI HELPERS
    ===================================================== */

    function setStatus(message) {
        elements.statusText.textContent = message;
    }

    function setDocumentControlsEnabled(enabled) {
        elements.downloadButton.disabled = !enabled;
        elements.pageNumberInput.disabled = !enabled;
        elements.previousPageButton.disabled = !enabled;
        elements.nextPageButton.disabled = !enabled;
        elements.zoomOutButton.disabled = !enabled;
        elements.zoomInButton.disabled = !enabled;
        elements.fitButton.disabled = !enabled;
    }

    function openFilePicker() {
        elements.fileInput.click();
    }

    /* =====================================================
       OPEN PDF
    ===================================================== */

    async function handleSelectedFile(file) {
        if (!file) {
            return;
        }

        const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            alert("Please choose a PDF file.");
            return;
        }

        if (file.size === 0) {
            alert("This file is empty.");
            return;
        }

        setStatus("Opening document…");
        elements.documentName.textContent = file.name;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            // Preserve an untouched copy of the original document.
            state.originalBytes = bytes.slice();
            state.fileName = file.name;

            const loadingTask = pdfjsLib.getDocument({
                data: bytes.slice()
            });

            const pdfDocument = await loadingTask.promise;

            state.pdfDocument = pdfDocument;
            state.currentPage = 1;
            state.scale = 1;

            elements.welcomePanel.hidden = true;
            elements.canvasWrap.hidden = false;

            elements.pageCount.textContent =
                String(pdfDocument.numPages);

            elements.totalPages.textContent =
                String(pdfDocument.numPages);

            setDocumentControlsEnabled(true);

            updatePageControls();
            updateZoomLabel();

            await buildThumbnails();
            await renderCurrentPage();

            setStatus("Document loaded");

        } catch (error) {
            console.error("PDF opening failed:", error);

            resetViewer();

            alert(
                "This PDF could not be opened. " +
                "It may be damaged, password-protected, or unsupported."
            );

            setStatus("Could not open document");
        }
    }

    /* =====================================================
       RESET VIEWER
    ===================================================== */

    function resetViewer() {
        state.pdfDocument = null;
        state.originalBytes = null;
        state.fileName = "";
        state.currentPage = 1;
        state.scale = 1;

        elements.documentName.textContent = "No document open";
        elements.canvasWrap.hidden = true;
        elements.welcomePanel.hidden = false;

        elements.thumbnailList.innerHTML =
            '<div class="empty-thumbnails">' +
                '<div class="empty-icon">▤</div>' +
                '<p>Your page thumbnails will appear here.</p>' +
            '</div>';

        elements.pageCount.textContent = "0";
        elements.totalPages.textContent = "0";
        elements.pageNumberInput.value = "1";

        setDocumentControlsEnabled(false);
        updateZoomLabel();
    }

    /* =====================================================
       RENDER CURRENT PAGE
    ===================================================== */

    async function renderCurrentPage() {
        if (!state.pdfDocument || state.isRendering) {
            return;
        }

        state.isRendering = true;

        try {
            if (state.renderTask) {
                state.renderTask.cancel();
                state.renderTask = null;
            }

            const page = await state.pdfDocument.getPage(
                state.currentPage
            );

            const viewport = page.getViewport({
                scale: state.scale
            });

            const outputScale = Math.min(
                window.devicePixelRatio || 1,
                2
            );

            elements.canvas.width = Math.floor(
                viewport.width * outputScale
            );

            elements.canvas.height = Math.floor(
                viewport.height * outputScale
            );

            elements.canvas.style.width =
                Math.floor(viewport.width) + "px";

            elements.canvas.style.height =
                Math.floor(viewport.height) + "px";

            elements.pageFrame.style.width =
                Math.floor(viewport.width) + "px";

            elements.pageFrame.style.height =
                Math.floor(viewport.height) + "px";

            const renderContext = {
                canvasContext: mainContext,
                viewport: viewport,
                transform: outputScale !== 1
                    ? [
                        outputScale,
                        0,
                        0,
                        outputScale,
                        0,
                        0
                    ]
                    : null
            };

            state.renderTask = page.render(renderContext);

            await state.renderTask.promise;

        } catch (error) {
            if (
                error &&
                error.name !== "RenderingCancelledException"
            ) {
                console.error("Page rendering failed:", error);
                setStatus("Page rendering failed");
            }

        } finally {
            state.renderTask = null;
            state.isRendering = false;
        }

        updatePageControls();
    }

    /* =====================================================
       BUILD PAGE THUMBNAILS
    ===================================================== */

    async function buildThumbnails() {
        elements.thumbnailList.innerHTML = "";

        for (
            let pageNumber = 1;
            pageNumber <= state.pdfDocument.numPages;
            pageNumber += 1
        ) {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "thumbnail-item";
            button.dataset.page = String(pageNumber);

            button.setAttribute(
                "aria-label",
                "Go to page " + pageNumber
            );

            const canvasWrap = document.createElement("span");
            canvasWrap.className = "thumbnail-canvas-wrap";

            const canvas = document.createElement("canvas");

            canvasWrap.appendChild(canvas);

            const label = document.createElement("span");

            label.className = "thumbnail-label";
            label.textContent = "Page " + pageNumber;

            button.appendChild(canvasWrap);
            button.appendChild(label);

            button.addEventListener("click", function () {
                goToPage(pageNumber);
            });

            elements.thumbnailList.appendChild(button);

            try {
                const page = await state.pdfDocument.getPage(
                    pageNumber
                );

                const baseViewport = page.getViewport({
                    scale: 1
                });

                const thumbnailWidth = 116;

                const thumbnailScale =
                    thumbnailWidth / baseViewport.width;

                const viewport = page.getViewport({
                    scale: thumbnailScale
                });

                const context = canvas.getContext("2d", {
                    alpha: false
                });

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

            } catch (error) {
                console.warn(
                    "Could not render thumbnail for page " +
                    pageNumber,
                    error
                );
            }
        }

        updateActiveThumbnail();
    }

    /* =====================================================
       ACTIVE THUMBNAIL
    ===================================================== */

    function updateActiveThumbnail() {
        const thumbnailButtons =
            elements.thumbnailList.querySelectorAll(
                ".thumbnail-item"
            );

        thumbnailButtons.forEach(function (button) {
            const isActive =
                Number(button.dataset.page) === state.currentPage;

            button.classList.toggle("active", isActive);

            if (isActive) {
                button.setAttribute("aria-current", "page");
            } else {
                button.removeAttribute("aria-current");
            }
        });
    }

    /* =====================================================
       PAGE CONTROLS
    ===================================================== */

    function updatePageControls() {
        if (!state.pdfDocument) {
            return;
        }

        elements.pageNumberInput.value =
            String(state.currentPage);

        elements.previousPageButton.disabled =
            state.currentPage <= 1;

        elements.nextPageButton.disabled =
            state.currentPage >= state.pdfDocument.numPages;

        updateActiveThumbnail();
    }

    /* =====================================================
       ZOOM LABEL
    ===================================================== */

    function updateZoomLabel() {
        elements.zoomValue.textContent =
            Math.round(state.scale * 100) + "%";
    }

    /* =====================================================
       PAGE NAVIGATION
    ===================================================== */

    async function goToPage(pageNumber) {
        if (!state.pdfDocument) {
            return;
        }

        const safePage = Math.max(
            1,
            Math.min(
                state.pdfDocument.numPages,
                Number(pageNumber)
            )
        );

        if (!Number.isFinite(safePage)) {
            return;
        }

        state.currentPage = safePage;

        updatePageControls();

        await renderCurrentPage();

        const activeThumbnail =
            elements.thumbnailList.querySelector(
                ".thumbnail-item.active"
            );

        if (activeThumbnail) {
            activeThumbnail.scrollIntoView({
                block: "nearest",
                behavior: "smooth"
            });
        }
    }

    /* =====================================================
       ZOOM
    ===================================================== */

    async function changeZoom(amount) {
        if (!state.pdfDocument) {
            return;
        }

        state.scale = Math.max(
            state.minScale,
            Math.min(
                state.maxScale,
                state.scale + amount
            )
        );

        updateZoomLabel();

        await renderCurrentPage();
    }

    /* =====================================================
       FIT PAGE
    ===================================================== */

    async function fitPage() {
        if (!state.pdfDocument) {
            return;
        }

        const page = await state.pdfDocument.getPage(
            state.currentPage
        );

        const unscaledViewport = page.getViewport({
            scale: 1
        });

        const stage = document.getElementById("documentStage");

        const availableWidth = Math.max(
            150,
            stage.clientWidth - 80
        );

        const availableHeight = Math.max(
            150,
            stage.clientHeight - 70
        );

        const widthScale =
            availableWidth / unscaledViewport.width;

        const heightScale =
            availableHeight / unscaledViewport.height;

        state.scale = Math.max(
            state.minScale,
            Math.min(
                state.maxScale,
                Math.min(widthScale, heightScale)
            )
        );

        updateZoomLabel();

        await renderCurrentPage();
    }

    /* =====================================================
       DOWNLOAD ORIGINAL PDF
    ===================================================== */

    function downloadOriginal() {
        if (!state.originalBytes) {
            return;
        }

        const blob = new Blob(
            [state.originalBytes],
            {
                type: "application/pdf"
            }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        const baseName = state.fileName.replace(
            /\.pdf$/i,
            ""
        );

        link.href = url;

        link.download =
            (baseName || "document") + "-copy.pdf";

        document.body.appendChild(link);

        link.click();

        link.remove();

        window.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    /* =====================================================
       FILE SELECTION
    ===================================================== */

    elements.openFileButton.addEventListener(
        "click",
        openFilePicker
    );

    elements.welcomeOpenButton.addEventListener(
        "click",
        openFilePicker
    );

    elements.fileInput.addEventListener(
        "change",
        async function (event) {
            const file =
                event.target.files &&
                event.target.files[0];

            await handleSelectedFile(file);

            event.target.value = "";
        }
    );

    /* =====================================================
       PAGE NAVIGATION EVENTS
    ===================================================== */

    elements.previousPageButton.addEventListener(
        "click",
        function () {
            goToPage(state.currentPage - 1);
        }
    );

    elements.nextPageButton.addEventListener(
        "click",
        function () {
            goToPage(state.currentPage + 1);
        }
    );

    elements.pageNumberInput.addEventListener(
        "change",
        function () {
            goToPage(elements.pageNumberInput.value);
        }
    );

    elements.pageNumberInput.addEventListener(
        "keydown",
        function (event) {
            if (event.key === "Enter") {
                goToPage(elements.pageNumberInput.value);
                elements.pageNumberInput.blur();
            }
        }
    );

    /* =====================================================
       ZOOM EVENTS
    ===================================================== */

    elements.zoomOutButton.addEventListener(
        "click",
        function () {
            changeZoom(-0.1);
        }
    );

    elements.zoomInButton.addEventListener(
        "click",
        function () {
            changeZoom(0.1);
        }
    );

    elements.fitButton.addEventListener(
        "click",
        fitPage
    );

    elements.downloadButton.addEventListener(
        "click",
        downloadOriginal
    );

    /* =====================================================
       DRAG AND DROP PDF OPENING
    ===================================================== */

    let dragDepth = 0;

    document.addEventListener(
        "dragenter",
        function (event) {
            event.preventDefault();

            dragDepth += 1;

            elements.dropOverlay.classList.add("visible");
        }
    );

    document.addEventListener(
        "dragover",
        function (event) {
            event.preventDefault();
        }
    );

    document.addEventListener(
        "dragleave",
        function (event) {
            event.preventDefault();

            dragDepth -= 1;

            if (dragDepth <= 0) {
                dragDepth = 0;

                elements.dropOverlay.classList.remove(
                    "visible"
                );
            }
        }
    );

    document.addEventListener(
        "drop",
        async function (event) {
            event.preventDefault();

            dragDepth = 0;

            elements.dropOverlay.classList.remove(
                "visible"
            );

            const files =
                event.dataTransfer &&
                event.dataTransfer.files;

            if (files && files.length > 0) {
                await handleSelectedFile(files[0]);
            }
        }
    );

    /* =====================================================
       KEYBOARD SHORTCUTS
    ===================================================== */

    document.addEventListener(
        "keydown",
        function (event) {
            const target = event.target;

            const isTyping =
                target &&
                (
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA"
                );

            if (
                isTyping ||
                !state.pdfDocument ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey
            ) {
                return;
            }

            if (
                event.key === "ArrowLeft" ||
                event.key === "PageUp"
            ) {
                goToPage(state.currentPage - 1);

            } else if (
                event.key === "ArrowRight" ||
                event.key === "PageDown"
            ) {
                goToPage(state.currentPage + 1);

            } else if (
                event.key === "+" ||
                event.key === "="
            ) {
                changeZoom(0.1);

            } else if (event.key === "-") {
                changeZoom(-0.1);
            }
        }
    );

    /* =====================================================
       WINDOW RESIZE
    ===================================================== */

    window.addEventListener(
        "resize",
        function () {
            if (state.pdfDocument) {
                renderCurrentPage();
            }
        }
    );

    /* =====================================================
       INITIALIZE
    ===================================================== */

    setDocumentControlsEnabled(false);

})();

