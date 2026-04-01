#target illustrator
/*
 * Standalone Illustrator utility for finding other page items that share the same
 * size as the single selected reference item.
 * The script requires exactly one selected item, scans the active document, and
 * selects every page item whose width and height match within a small tolerance,
 * including the original reference item itself.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/auto_group_paths_common.jsx"

(function () {
    try {
        var document = pathGroupGetActiveDocument();
        var selection = pathGroupNormalizeSelection(app.selection);
        var tolerance = 0.01;
        var matches = [];
        var referenceItem;
        var referenceBounds;
        var referenceWidth;
        var referenceHeight;
        var i;

        if (!selection || selection.length !== 1) {
            throw new Error("Select exactly one item before running the same-size finder utility.");
        }

        referenceItem = selection[0];
        referenceBounds = pathGroupGetItemBounds(referenceItem);

        if (!referenceBounds) {
            throw new Error("The selected item does not expose measurable bounds.");
        }

        referenceWidth = referenceBounds.width;
        referenceHeight = referenceBounds.height;

        try {
            if (document.pageItems && document.pageItems.length) {
                for (i = 0; i < document.pageItems.length; i++) {
                    var candidate = document.pageItems[i];
                    var candidateBounds;

                    if (!candidate) {
                        continue;
                    }

                    candidateBounds = pathGroupGetItemBounds(candidate);
                    if (!candidateBounds) {
                        continue;
                    }

                    if (
                        Math.abs(candidateBounds.width - referenceWidth) <= tolerance &&
                        Math.abs(candidateBounds.height - referenceHeight) <= tolerance
                    ) {
                        matches.push(candidate);
                    }
                }
            }
        } catch (scanError) {
            throw new Error("Failed to scan the document for same-size items: " + scanError.message);
        }

        if (!matches.length) {
            return "No other items with the same size were found.";
        }

        pathGroupClearSelection(document);

        for (i = 0; i < matches.length; i++) {
            try {
                matches[i].selected = true;
            } catch (selectError) {
            }
        }

        try {
            app.redraw();
        } catch (redrawError) {
        }

        return "Found " + matches.length + " item(s) with the same size as the selected item.";
    } catch (error) {
        throw error;
    }
})();
