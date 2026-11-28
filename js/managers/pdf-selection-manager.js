
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

        this.longPressDuration = 450;
        this.movementThreshold = 12;

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
                "#toolbarRows, .toolbar, [data-selection-action]"
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

        if (!this.isTextLayerNode(event.target)) {
            this.clear();
            return;
        }

        if (event.pointerType !== "touch") {
            return;
        }

        this.clearPendingTimer();

        this.pendingPointer = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY
        };

        const pointer = {
            x: event.clientX,
            y: event.clientY
        };

        this.pendingTimer = setTimeout(() => {
            this.pendingTimer = null;
            this.pendingPointer = null;

            this.startLongPressSelection(pointer);
        }, this.longPressDuration);
    }

    handlePointerMove(event) {
        if (
            this.pendingTimer !== null &&
            this.pendingPointer &&
            event.pointerId === this.pendingPointer.pointerId
        ) {
            const distance = Math.hypot(
                event.clientX - this.pendingPointer.x,
                event.clientY - this.pendingPointer.y
            );

            if (distance > this.movementThreshold) {
                this.clearPendingTimer();
            }
        }

        if (
            !this.isDraggingHandle ||
            event.pointerId !== this.dragPointerId ||
            !this.activeHandle
        ) {
            return;
        }

        event.preventDefault();

        const position = this.rangeManager.getPositionAtPoint(
            event.clientX,
            event.clientY
        );

        if (!position || !this.touchStart || !this.touchEnd) {
            return;
        }

        this.updateTouchRange(position);
    }

    updateTouchRange(position) {
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

        this.activeRange = this.touchRange.cloneRange();

        this.scheduleRender();
        this.dispatchSelectionChange();
    }

    startLongPressSelection(pointer) {
        if (!pointer) {
            return;
        }

        const position = this.rangeManager.getPositionAtPoint(
            pointer.x,
            pointer.y
        );

        if (!position) {
            return;
        }

        const range = this.rangeManager.getWordRange(position);

        if (!range) {
            return;
        }

        const selection = window.getSelection();

        if (selection) {
            selection.removeAllRanges();
        }

        this.isTouchSelecting = true;

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

        if (!this.touchRange) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.clearPendingTimer();

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
        if (
            this.pendingPointer &&
            event.pointerId === this.pendingPointer.pointerId
        ) {
            this.clearPendingTimer();
        }

        if (
            !this.isDraggingHandle ||
            event.pointerId !== this.dragPointerId
        ) {
            return;
        }

        this.isDraggingHandle = false;
        this.activeHandle = null;
        this.dragPointerId = null;
    }

    handleSelectionChange() {
        if (this.isTouchSelecting || this.isDraggingHandle) {
            return;
        }

        const selection = window.getSelection();

        if (
            !selection ||
            selection.isCollapsed ||
            selection.rangeCount === 0
        ) {
            this.activeRange = null;

            this.scheduleRender();
            this.dispatchSelectionChange();

            return;
        }

        if (
            !this.isTextLayerNode(selection.anchorNode) ||
            !this.isTextLayerNode(selection.focusNode)
        ) {
            this.activeRange = null;

            this.scheduleRender();
            this.dispatchSelectionChange();

            return;
        }

        this.touchRange = null;
        this.touchStart = null;
        this.touchEnd = null;

        this.activeRange = selection.getRangeAt(0).cloneRange();

        this.scheduleRender();
        this.dispatchSelectionChange();
    }

    handleContextMenu(event) {
        if (this.isTextLayerNode(event.target)) {
            event.preventDefault();
        }
    }

    scheduleRender() {
        if (this.renderFrame !== null) {
            return;
        }

        this.renderFrame = requestAnimationFrame(() => {
            this.renderFrame = null;

            this.renderer.render(
                this.activeRange,
                Boolean(this.touchRange)
            );
        });
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

        this.activeHandle = null;
        this.dragPointerId = null;

        if (clearNativeSelection) {
            const selection = window.getSelection();

            if (selection) {
                selection.removeAllRanges();
            }
        }

        this.renderer.render(null, false);
        

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
