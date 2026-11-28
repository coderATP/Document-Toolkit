
export class PdfPagePanManager {

    constructor(app) {
        this.app = app;

        this.stage = document.getElementById(
            "documentStage"
        );

        /*
         * Mouse-driven page panning is disabled.
         *
         * Mouse dragging is handled exclusively
         * by PdfSelectionManager for text selection.
         *
         * Touch panning remains native to the
         * document stage.
         */

    }

}
