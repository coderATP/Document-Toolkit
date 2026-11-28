
import {
    PdfSelectionRangeManager
} from "./pdf-selection-range-manager.js";

import {
    PdfSelectionRenderer
} from "./pdf-selection-renderer.js";

export class PdfSelectionManager {

    constructor(app) {
        this.app = app;

        this.rangeManager = new PdfSelectionRangeManager(app);

        this.renderer = new PdfSelectionRenderer(
            app,
            (event, type) => {
                this.beginHandleDrag(event, type);
            }
        );

        this.activeRange = null;
        this.touchRange = null;

        this.touchStart = null;
        this.touchEnd = null;

        this.pendingTimer = null;
        this.pendingPointer = null;

        this.activeHandle = null;
        this.dragPointerId = null;

        this.isDraggingHandle = false;
        this.isTouchSelecting = false;
        this.touchSelectionPointerId = null;

        this.longPressDuration = 450;
        this.movementThreshold = 12;

        this.mousePointerId = null;
        this.mouseStart = null;
        this.mouseOrigin = null;
        this.mouseHasMoved = false;
        this.isMouseSelecting = false;

        this.renderFrame = null;

        this.handleSelectionChange =
            this.handleSelectionChange.bind(this);

        this.handlePointerDown =
            this.handlePointerDown.bind(this);

        this.handlePointerMove =
            this.handlePointerMove.bind(this);

        this.handlePointerUp =
            this.handlePointerUp.bind(this);

        this.handleContextMenu =
            this.handleContextMenu.bind(this);

        document.addEventListener(
            "selectionchange",
            this.handleSelectionChange
        );

        document.addEventListener(
            "pointerdown",
            this.handlePointerDown
        );

        document.addEventListener(
            "pointermove",
            this.handlePointerMove
        );

        document.addEventListener(
            "pointerup",
            this.handlePointerUp
        );

        document.addEventListener(
            "pointercancel",
            this.handlePointerUp
        );

        document.addEventListener(
            "contextmenu",
            this.handleContextMenu
        );
    }

    getTextLayer() {
        return this.app.textLayer.container;
    }

    isTextLayerNode(node) {
        return this.rangeManager.isTextLayerNode(node);
    }

    isToolbarTarget(target) {
        if (!target || !target.closest) {
            return false;
        }

        return Boolean(
            target.closest(
                [
                    "#toolbarRows",
                    ".toolbar",
                    "[data-selection-action]",
                    ".pdf-scrollbar-overlay"
                ].join(", ")
            )
        );
    }

    isSelectionHandle(target) {
        if (!target || !target.closest) {
            return false;
        }

        return Boolean(
            target.closest(".pdf-selection-handle")
        );
    }

    sync(viewport) {
        this.clear(false);

        this.renderer.sync(viewport);
    }

    
handlePointerDown(event) {
    if (this.isSelectionHandle(event.target)) {
        return;
    }

    if (this.isToolbarTarget(event.target)) {
        return;
    }

    /*
     * Mouse and pen selection.
     */

    if (
        event.pointerType === "mouse" ||
        event.pointerType === "pen"
    ) {
        if (event.button !== 0) {
            return;
        }

        const stage =
            this.app.ui.elements.documentStage;

        if (
            !this.app.document.hasDocument ||
            !stage.contains(event.target)
        ) {
            return;
        }

        if (
            event.target.closest &&
            event.target.closest(
                ".annotation-layer, .pdf-scrollbar-overlay"
            )
        ) {
            return;
        }

        const position =
            this.rangeManager.getPositionAtPoint(
                event.clientX,
                event.clientY
            );

        const hasSelection = Boolean(
            this.activeRange &&
            !this.activeRange.collapsed
        );

        const startedInsideSelection =
            hasSelection &&
            this.isPointInsideRange(
                this.activeRange,
                event.clientX,
                event.clientY
            );

        /*
         * Preserve an existing selection when the
         * mouse press begins inside it.
         */
        if (startedInsideSelection) {
            return;
        }

        /*
         * A press outside the existing selection
         * starts a new selection attempt.
         */
        if (hasSelection) {
            this.clear();
        }

        /*
         * Position may be null when the pointer
         * starts on a blank part of the page.
         *
         * Selection will begin when the pointer
         * first reaches actual PDF text.
         */
        this.beginMouseSelection(
            position,
            event.clientX,
            event.clientY,
            event.pointerId
        );

        event.preventDefault();

        return;
    }

    /*
     * Touch selection.
     * Keep the existing long-press behaviour.
     */

    if (event.pointerType !== "touch") {
        if (!this.isTextLayerNode(event.target)) {
            this.clear();
        }

        return;
    }

    if (!this.isTextLayerNode(event.target)) {
        this.clear();
        return;
    }

    this.clearPendingTimer();

    const hasSelection = Boolean(
        this.activeRange &&
        !this.activeRange.collapsed
    );

    const startedInsideSelection =
        hasSelection &&
        this.isPointInsideRange(
            this.activeRange,
            event.clientX,
            event.clientY
        );

    this.pendingPointer = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        startedInsideSelection: startedInsideSelection
    };

    if (startedInsideSelection) {
        return;
    }

    const pointer = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId
    };

    this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.pendingPointer = null;

        this.startLongPressSelection(pointer);

    }, this.longPressDuration);
}


    

beginMouseSelection(position, clientX, clientY, pointerId) {
    this.clearPendingTimer();

    this.mousePointerId = pointerId;
    this.mouseStart = position;

    this.mouseOrigin = {
        x: clientX,
        y: clientY
    };

    this.mouseHasMoved = false;
    this.isMouseSelecting = true;

    return true;
}

    handlePointerMove(event) {
        /*
         * Touch gesture tracking.
         */

        if (
            this.pendingPointer &&
            event.pointerId === this.pendingPointer.pointerId
        ) {
            const distance = Math.hypot(
                event.clientX - this.pendingPointer.x,
                event.clientY - this.pendingPointer.y
            );

            if (distance > this.movementThreshold) {
                this.pendingPointer.moved = true;

                if (this.pendingTimer !== null) {
                    clearTimeout(this.pendingTimer);
                    this.pendingTimer = null;
                }

                if (
                    this.activeRange &&
                    !this.pendingPointer.startedInsideSelection
                ) {
                    this.clear();
                    return;
                }
            }
        }


/*
 * Mouse and pen text selection.
 */

if (
    this.isMouseSelecting &&
    event.pointerId === this.mousePointerId
) {
    const distance = Math.hypot(
        event.clientX - this.mouseOrigin.x,
        event.clientY - this.mouseOrigin.y
    );

    if (distance < 3) {
        return;
    }

    this.mouseHasMoved = true;

    /*
     * If selection started on blank space,
     * wait until the pointer reaches actual text.
     */
    if (!this.mouseStart) {
        const firstPosition =
            this.rangeManager.getPositionAtPoint(
                event.clientX,
                event.clientY
            );

        if (!firstPosition) {
            return;
        }

        this.mouseStart = firstPosition;
    }

    /*
     * Once selection has started, allow the pointer
     * to reach nearby blank areas and line boundaries.
     */
    let position =
        this.rangeManager.getPositionAtPoint(
            event.clientX,
            event.clientY
        );

    if (!position) {
        position =
            this.rangeManager.getPositionAtPointForDrag(
                event.clientX,
                event.clientY,
                "end"
            );
    }

    if (!position) {
        return;
    }

    event.preventDefault();

    this.activeRange = this.rangeManager.createRange(
        this.mouseStart,
        position
    );

    if (!this.activeRange) {
        return;
    }

    const positions =
        this.rangeManager.getRangePositions(
            this.activeRange
        );

    this.touchStart = positions.start;
    this.touchEnd = positions.end;

    this.touchRange =
        this.activeRange.cloneRange();

    const direction =
        this.rangeManager.comparePositions(
            position,
            this.mouseStart
        );

    this.activeHandle =
        direction >= 0 ? "end" : "start";

    this.updatePreview(
        position,
        event.clientX,
        event.clientY
    );

    this.scheduleRender();
    this.dispatchSelectionChange();

    return;
}

        /*
         * Selection-handle dragging.
         */

        if (
            !this.isDraggingHandle ||
            event.pointerId !== this.dragPointerId ||
            !this.activeHandle
        ) {
            return;
        }

        event.preventDefault();

        const position =
            this.rangeManager.getPositionAtPointForDrag(
                event.clientX,
                event.clientY,
                this.activeHandle
            );

        if (!position || !this.touchStart || !this.touchEnd) {
            return;
        }

        this.updateTouchRange(
            position,
            event.clientX,
            event.clientY
        );
    }

    updateTouchRange(position, clientX, clientY) {
        const comparisonToStart =
            this.rangeManager.comparePositions(
                position,
                this.touchStart
            );

        const comparisonToEnd =
            this.rangeManager.comparePositions(
                position,
                this.touchEnd
            );

        if (this.activeHandle === "start") {
            if (comparisonToEnd <= 0) {
                this.touchStart = position;

            } else {
                this.touchStart = this.touchEnd;
                this.touchEnd = position;
                this.activeHandle = "end";
            }

        } else {
            if (comparisonToStart >= 0) {
                this.touchEnd = position;

            } else {
                this.touchEnd = this.touchStart;
                this.touchStart = position;
                this.activeHandle = "start";
            }
        }

        this.touchRange = this.rangeManager.createRange(
            this.touchStart,
            this.touchEnd
        );

        if (!this.touchRange) {
            return;
        }

        this.activeRange =
            this.touchRange.cloneRange();

        this.updatePreview(
            position,
            clientX,
            clientY
        );

        this.scheduleRender();
        this.dispatchSelectionChange();
    }

    updatePreview(position, clientX, clientY) {
        const context =
            this.rangeManager.getPreviewContext(position);

        if (!context) {
            this.renderer.hidePreview();
            return;
        }

        this.renderer.updatePreview(
            context,
            clientX,
            clientY
        );
    }

    startLongPressSelection(pointer) {
        if (!pointer) {
            return;
        }

        const position =
            this.rangeManager.getPositionAtPoint(
                pointer.x,
                pointer.y
            );

        if (!position) {
            return;
        }

        const range =
            this.rangeManager.getWordRange(position);

        if (!range) {
            return;
        }

        const selection = window.getSelection();

        if (selection) {
            selection.removeAllRanges();
        }

        this.isTouchSelecting = true;
        this.touchSelectionPointerId = pointer.pointerId;

        this.touchRange = range;
        this.activeRange = range.cloneRange();

        const positions =
            this.rangeManager.getRangePositions(range);

        this.touchStart = positions.start;
        this.touchEnd = positions.end;

        this.scheduleRender();
        this.dispatchSelectionChange();
    }

    beginHandleDrag(event, type) {
        if (
            event.pointerType !== "touch" &&
            event.pointerType !== "mouse" &&
            event.pointerType !== "pen"
        ) {
            return;
        }

        if (!this.activeRange || this.activeRange.collapsed) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.clearPendingTimer();

        if (!this.touchStart || !this.touchEnd) {
            const positions =
                this.rangeManager.getRangePositions(
                    this.activeRange
                );

            if (!positions) {
                return;
            }

            this.touchStart = positions.start;
            this.touchEnd = positions.end;
        }

        this.touchRange =
            this.activeRange.cloneRange();

        this.isDraggingHandle = true;
        this.activeHandle = type;
        this.dragPointerId = event.pointerId;

        try {
            event.currentTarget.setPointerCapture(
                event.pointerId
            );
        } catch (error) {
            // Document-level pointer listeners remain available.
        }
    }

    handlePointerUp(event) {
        /*
         * Finish touch tap or drag.
         */

        if (
            this.pendingPointer &&
            event.pointerId === this.pendingPointer.pointerId
        ) {
            const pointer = this.pendingPointer;

            if (this.pendingTimer !== null) {
                clearTimeout(this.pendingTimer);
                this.pendingTimer = null;
            }

            this.pendingPointer = null;

            if (
                !pointer.moved &&
                this.activeRange &&
                !pointer.startedInsideSelection
            ) {
                this.clear();
            }

            return;
        }

        /*
         * Finish long-press selection.
         */

        if (
            this.isTouchSelecting &&
            event.pointerId === this.touchSelectionPointerId
        ) {
            this.isTouchSelecting = false;
            this.touchSelectionPointerId = null;

            return;
        }

        /*
         * Finish mouse text selection.
         */

        if (
            this.isMouseSelecting &&
            event.pointerId === this.mousePointerId
        ) {
            const completedDrag = this.mouseHasMoved;

            this.isMouseSelecting = false;
            this.mousePointerId = null;
            this.mouseStart = null;
            this.mouseOrigin = null;
            this.mouseHasMoved = false;

            this.renderer.hidePreview();

            if (!completedDrag) {
                const clickedInsideSelection =
                    this.activeRange &&
                    this.isPointInsideRange(
                        this.activeRange,
                        event.clientX,
                        event.clientY
                    );

                if (!clickedInsideSelection) {
                    this.clear();
                }
            }

            return;
        }

        /*
         * Finish selection-handle dragging.
         */

        if (
            !this.isDraggingHandle ||
            event.pointerId !== this.dragPointerId
        ) {
            return;
        }

        this.isDraggingHandle = false;
        this.activeHandle = null;
        this.dragPointerId = null;

        this.renderer.hidePreview();
    }

    handleSelectionChange() {
        if (
            this.isTouchSelecting ||
            this.isDraggingHandle ||
            this.isMouseSelecting
        ) {
            return;
        }

        const selection = window.getSelection();

        if (
            !selection ||
            selection.isCollapsed ||
            selection.rangeCount === 0
        ) {
            this.activeRange = null;
            this.touchRange = null;
            this.touchStart = null;
            this.touchEnd = null;

            this.scheduleRender();
            this.dispatchSelectionChange();

            return;
        }

        if (
            !this.isTextLayerNode(selection.anchorNode) ||
            !this.isTextLayerNode(selection.focusNode)
        ) {
            this.activeRange = null;
            this.touchRange = null;
            this.touchStart = null;
            this.touchEnd = null;

            this.scheduleRender();
            this.dispatchSelectionChange();

            return;
        }

        this.activeRange =
            selection.getRangeAt(0).cloneRange();

        this.touchRange =
            this.activeRange.cloneRange();

        const positions =
            this.rangeManager.getRangePositions(
                this.activeRange
            );

        if (!positions) {
            return;
        }

        this.touchStart = positions.start;
        this.touchEnd = positions.end;

        this.scheduleRender();
        this.dispatchSelectionChange();
    }

    handleContextMenu(event) {
        if (!this.isTextLayerNode(event.target)) {
            return;
        }

        event.preventDefault();

        const range =
            this.rangeManager.getSpanRangeAtPoint(
                event.clientX,
                event.clientY,
                event.target
            );

        if (!range || range.collapsed) {
            return;
        }

        const selection = window.getSelection();

        if (selection) {
            selection.removeAllRanges();
        }

        this.activeRange = range;
        this.touchRange = range.cloneRange();

        const positions =
            this.rangeManager.getRangePositions(range);

        if (!positions) {
            return;
        }

        this.touchStart = positions.start;
        this.touchEnd = positions.end;

        this.isMouseSelecting = false;
        this.mousePointerId = null;
        this.mouseStart = null;
        this.mouseOrigin = null;
        this.mouseHasMoved = false;

        this.renderer.hidePreview();

        this.scheduleRender();
        this.dispatchSelectionChange();
    }

    scheduleRender() {
        if (this.renderFrame !== null) {
            return;
        }

        this.renderFrame = requestAnimationFrame(() => {
            this.renderFrame = null;

            this.renderer.render(
                this.activeRange,
                Boolean(
                    this.activeRange &&
                    !this.activeRange.collapsed
                )
            );
        });
    }

    isPointInsideRange(range, x, y) {
        if (!range || range.collapsed) {
            return false;
        }

        for (const rect of range.getClientRects()) {
            if (
                x >= rect.left - 2 &&
                x <= rect.right + 2 &&
                y >= rect.top - 2 &&
                y <= rect.bottom + 2
            ) {
                return true;
            }
        }

        return false;
    }

    getSelectedText() {
        if (!this.activeRange) {
            return "";
        }

        return this.activeRange.toString();
    }

    dispatchSelectionChange() {
        document.dispatchEvent(
            new CustomEvent("pdftextselectionchange", {
                detail: {
                    text: this.getSelectedText(),

                    range: this.activeRange
                        ? this.activeRange.cloneRange()
                        : null
                }
            })
        );
    }

    clearPendingTimer() {
        if (this.pendingTimer !== null) {
            clearTimeout(this.pendingTimer);
            this.pendingTimer = null;
        }

        this.pendingPointer = null;
    }

    clear(clearNativeSelection = true) {
        this.clearPendingTimer();

        if (this.renderFrame !== null) {
            cancelAnimationFrame(this.renderFrame);
            this.renderFrame = null;
        }

        this.activeRange = null;
        this.touchRange = null;

        this.touchStart = null;
        this.touchEnd = null;

        this.isDraggingHandle = false;
        this.isTouchSelecting = false;
        this.touchSelectionPointerId = null;

        this.mousePointerId = null;
        this.mouseStart = null;
        this.mouseOrigin = null;
        this.mouseHasMoved = false;
        this.isMouseSelecting = false;

        this.activeHandle = null;
        this.dragPointerId = null;

        if (clearNativeSelection) {
            const selection = window.getSelection();

            if (selection) {
                selection.removeAllRanges();
            }
        }

        this.renderer.render(null, false);
        this.renderer.hidePreview();

        this.dispatchSelectionChange();
    }

    destroy() {
        this.clear();

        this.renderer.clear();

        document.removeEventListener(
            "selectionchange",
            this.handleSelectionChange
        );

        document.removeEventListener(
            "pointerdown",
            this.handlePointerDown
        );

        document.removeEventListener(
            "pointermove",
            this.handlePointerMove
        );

        document.removeEventListener(
            "pointerup",
            this.handlePointerUp
        );

        document.removeEventListener(
            "pointercancel",
            this.handlePointerUp
        );

        document.removeEventListener(
            "contextmenu",
            this.handleContextMenu
        );
    }
}
