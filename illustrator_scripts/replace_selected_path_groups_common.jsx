/*
 * Shared utilities for replacing selected path groups with multiline text.
 * The workflow previews each eligible selected group, captures a rotation and
 * replacement string per group, and creates a centered rotated area-text object
 * fitted to the group's bounds.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/auto_group_paths_common.jsx"

function replaceSelectedPathGroupsGetActiveDocument() {
    return pathGroupGetActiveDocument();
}

function replaceSelectedPathGroupsNormalizeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
}

function replaceSelectedPathGroupsNormalizeNumber(value, fallbackValue) {
    var numberValue = Number(value);

    if (typeof numberValue !== "number" || isNaN(numberValue) || !isFinite(numberValue)) {
        return typeof fallbackValue === "number" ? fallbackValue : 0;
    }

    return numberValue;
}

function replaceSelectedPathGroupsNormalizeRotation(value) {
    return replaceSelectedPathGroupsNormalizeNumber(value, 0);
}

function replaceSelectedPathGroupsNormalizeFitFactor(value) {
    var fitFactor = replaceSelectedPathGroupsNormalizeNumber(value, 1.0);

    if (fitFactor < 0) {
        fitFactor = 0;
    }

    if (fitFactor > 1) {
        fitFactor = 1;
    }

    return fitFactor;
}

function replaceSelectedPathGroupsNormalizeTextSizeFactor(value) {
    var sizeFactor = replaceSelectedPathGroupsNormalizeNumber(value, 1.0);

    if (sizeFactor < 0) {
        sizeFactor = 0;
    }

    return sizeFactor;
}

function replaceSelectedPathGroupsIsPathLeaf(item) {
    return pathGroupIsPathItem(item) || pathGroupIsCompoundPathItem(item);
}

function replaceSelectedPathGroupsCountAnchorPoints(item) {
    var anchorCount = 0;

    if (!item) {
        return anchorCount;
    }

    if (pathGroupIsPathItem(item)) {
        try {
            anchorCount = item.pathPoints && typeof item.pathPoints.length === "number" ? item.pathPoints.length : 0;
        } catch (pathPointsError) {
            anchorCount = 0;
        }

        return anchorCount;
    }

    if (pathGroupIsCompoundPathItem(item)) {
        try {
            if (item.pathItems && typeof item.pathItems.length === "number") {
                for (var i = 0; i < item.pathItems.length; i++) {
                    try {
                        if (item.pathItems[i] && item.pathItems[i].pathPoints && typeof item.pathItems[i].pathPoints.length === "number") {
                            anchorCount += item.pathItems[i].pathPoints.length;
                        }
                    } catch (compoundPathPointsError) {
                    }
                }
            }
        } catch (compoundPathsError) {
            anchorCount = 0;
        }
    }

    return anchorCount;
}

function replaceSelectedPathGroupsArrayContains(items, item) {
    for (var i = items.length - 1; i >= 0; i--) {
        if (items[i] === item) {
            return true;
        }
    }

    return false;
}

function replaceSelectedPathGroupsBoundsToObject(bounds) {
    if (!bounds || bounds.length < 4) {
        return null;
    }

    var left = bounds[0];
    var top = bounds[1];
    var right = bounds[2];
    var bottom = bounds[3];

    if (left > right) {
        var swapLeft = left;
        left = right;
        right = swapLeft;
    }

    if (bottom > top) {
        var swapTop = top;
        top = bottom;
        bottom = swapTop;
    }

    return {
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        width: right - left,
        height: top - bottom,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2
    };
}

function replaceSelectedPathGroupsScaleBounds(bounds, fitFactor) {
    if (!bounds) {
        return null;
    }

    var normalizedFitFactor = replaceSelectedPathGroupsNormalizeFitFactor(fitFactor);
    var centerX = (bounds.left + bounds.right) / 2;
    var centerY = (bounds.top + bounds.bottom) / 2;
    var halfWidth = (bounds.width * normalizedFitFactor) / 2;
    var halfHeight = (bounds.height * normalizedFitFactor) / 2;

    return {
        left: centerX - halfWidth,
        top: centerY + halfHeight,
        right: centerX + halfWidth,
        bottom: centerY - halfHeight,
        width: bounds.width * normalizedFitFactor,
        height: bounds.height * normalizedFitFactor,
        centerX: centerX,
        centerY: centerY
    };
}

function replaceSelectedPathGroupsGetPageItemBounds(item) {
    try {
        return replaceSelectedPathGroupsBoundsToObject(item.visibleBounds);
    } catch (visibleBoundsError) {
        try {
            return replaceSelectedPathGroupsBoundsToObject(item.geometricBounds);
        } catch (geometricBoundsError) {
            return null;
        }
    }
}

function replaceSelectedPathGroupsDescribeColor(color) {
    if (!color) {
        return "none";
    }

    try {
        if (color.typename === "RGBColor") {
            return "rgb(" + Math.round(color.red) + "," + Math.round(color.green) + "," + Math.round(color.blue) + ")";
        }

        if (color.typename === "CMYKColor") {
            return "cmyk(" + Math.round(color.cyan) + "," + Math.round(color.magenta) + "," + Math.round(color.yellow) + "," + Math.round(color.black) + ")";
        }

        if (color.typename === "GrayColor") {
            return "gray(" + Math.round(color.gray) + ")";
        }
    } catch (error) {
        return "unknown";
    }

    return color.typename ? color.typename : "unknown";
}

function replaceSelectedPathGroupsDescribeAppearance(item) {
    var target = pathGroupGetAppearanceTarget(item);
    if (!target) {
        return "no appearance";
    }

    var parts = [];

    try {
        if (target.filled === false) {
            parts.push("no fill");
        } else {
            parts.push("fill " + replaceSelectedPathGroupsDescribeColor(target.fillColor));
        }
    } catch (fillError) {
        parts.push("fill unknown");
    }

    try {
        if (target.stroked === true || (typeof target.strokeWeight === "number" && target.strokeWeight > 0)) {
            parts.push("stroke " + replaceSelectedPathGroupsDescribeColor(target.strokeColor));
        } else {
            parts.push("no stroke");
        }
    } catch (strokeError) {
        parts.push("stroke unknown");
    }

    try {
        if (typeof target.opacity === "number") {
            parts.push("opacity " + Math.round(target.opacity));
        }
    } catch (opacityError) {
    }

    return parts.join(", ");
}

function replaceSelectedPathGroupsCompareLeafOrder(leftEntry, rightEntry) {
    var leftBounds = leftEntry && leftEntry.bounds ? leftEntry.bounds : null;
    var rightBounds = rightEntry && rightEntry.bounds ? rightEntry.bounds : null;
    var tolerance = 0.5;

    if (leftBounds && rightBounds) {
        if (Math.abs(leftBounds.top - rightBounds.top) > tolerance) {
            return leftBounds.top > rightBounds.top ? -1 : 1;
        }

        if (Math.abs(leftBounds.left - rightBounds.left) > tolerance) {
            return leftBounds.left < rightBounds.left ? -1 : 1;
        }
    }

    var leftIndex = typeof leftEntry.collectionIndex === "number" ? leftEntry.collectionIndex : 0;
    var rightIndex = typeof rightEntry.collectionIndex === "number" ? rightEntry.collectionIndex : 0;

    if (leftIndex < rightIndex) {
        return -1;
    }

    if (leftIndex > rightIndex) {
        return 1;
    }

    return 0;
}

function replaceSelectedPathGroupsCollectLeafPathsFromContainer(item, leaves, visited, state) {
    if (!item || state.invalid || replaceSelectedPathGroupsArrayContains(visited, item)) {
        return;
    }

    visited.push(item);

    if (replaceSelectedPathGroupsIsPathLeaf(item)) {
        var bounds = replaceSelectedPathGroupsGetPageItemBounds(item);
        var anchorCount = replaceSelectedPathGroupsCountAnchorPoints(item);
        if (bounds && anchorCount >= 3) {
            leaves.push({
                item: item,
                bounds: bounds,
                collectionIndex: leaves.length
            });
        } else {
            state.invalid = true;
        }
        return;
    }

    if (!pathGroupIsGroupItem(item) && item.typename !== "Layer" && item.typename !== "Document") {
        state.invalid = true;
        return;
    }

    try {
        if (item.pageItems && item.pageItems.length) {
            for (var i = 0; i < item.pageItems.length; i++) {
                replaceSelectedPathGroupsCollectLeafPathsFromContainer(item.pageItems[i], leaves, visited, state);
            }
        }
    } catch (pageItemsError) {
        state.invalid = true;
    }
}

function replaceSelectedPathGroupsSnapshotPathAppearance(sourcePath) {
    var snapshot = {
        filled: false,
        stroked: false,
        fillColor: null,
        strokeColor: null,
        strokeWeight: 0,
        hasFillColor: false,
        hasStrokeColor: false,
        hasStrokeWeight: false,
        opacity: null,
        hasOpacity: false,
        overprintFill: null,
        hasOverprintFill: false,
        overprintStroke: null,
        hasOverprintStroke: false
    };

    if (!sourcePath) {
        return snapshot;
    }

    var appearanceTarget = pathGroupGetAppearanceTarget(sourcePath);
    if (!appearanceTarget) {
        return snapshot;
    }

    try {
        snapshot.filled = !!appearanceTarget.filled;
    } catch (filledError) {
    }

    try {
        snapshot.stroked = !!appearanceTarget.stroked;
    } catch (strokedError) {
    }

    try {
        snapshot.fillColor = appearanceTarget.fillColor;
        snapshot.hasFillColor = true;
    } catch (fillColorError) {
    }

    try {
        snapshot.strokeColor = appearanceTarget.strokeColor;
        snapshot.hasStrokeColor = true;
    } catch (strokeColorError) {
    }

    try {
        snapshot.strokeWeight = appearanceTarget.strokeWeight;
        snapshot.hasStrokeWeight = true;
    } catch (strokeWeightError) {
    }

    try {
        snapshot.opacity = appearanceTarget.opacity;
        snapshot.hasOpacity = true;
    } catch (opacityError) {
    }

    try {
        snapshot.overprintFill = appearanceTarget.overprintFill;
        snapshot.hasOverprintFill = true;
    } catch (overprintFillError) {
    }

    try {
        snapshot.overprintStroke = appearanceTarget.overprintStroke;
        snapshot.hasOverprintStroke = true;
    } catch (overprintStrokeError) {
    }

    return snapshot;
}

function replaceSelectedPathGroupsCreateVisibleBlackColor() {
    var color = new RGBColor();
    color.red = 0;
    color.green = 0;
    color.blue = 0;
    return color;
}

function replaceSelectedPathGroupsApplyPathAppearance(textFrame, sourcePath) {
    if (!textFrame || !sourcePath) {
        return;
    }

    var appearance = replaceSelectedPathGroupsSnapshotPathAppearance(sourcePath);
    var characterAttributes = null;

    try {
        characterAttributes = textFrame.textRange.characterAttributes;
    } catch (error) {
        characterAttributes = null;
    }

    if (!characterAttributes) {
        return;
    }

    try {
        characterAttributes.filled = true;
        if (appearance.hasFillColor && !pathGroupIsBlackColor(appearance.fillColor)) {
            characterAttributes.fillColor = appearance.fillColor;
        } else {
            characterAttributes.fillColor = replaceSelectedPathGroupsCreateVisibleBlackColor();
        }
    } catch (fillError) {
    }

    try {
        if (appearance.hasStrokeColor && appearance.hasStrokeWeight && appearance.strokeWeight > 0) {
            characterAttributes.stroked = true;
            characterAttributes.strokeColor = appearance.strokeColor;
            characterAttributes.strokeWeight = appearance.strokeWeight;
        } else {
            characterAttributes.stroked = false;
            characterAttributes.strokeWeight = 0;
        }
    } catch (strokeColorError) {
    }

    try {
        if (appearance.hasOverprintFill) {
            characterAttributes.overprintFill = appearance.overprintFill;
        }
    } catch (overprintFillError) {
    }

    try {
        if (appearance.hasOverprintStroke) {
            characterAttributes.overprintStroke = appearance.overprintStroke;
        }
    } catch (overprintStrokeError) {
    }

    try {
        if (appearance.hasOpacity) {
            textFrame.opacity = appearance.opacity;
        }
    } catch (opacityError) {
    }
}

function replaceSelectedPathGroupsSetCenterJustification(textFrame) {
    if (!textFrame) {
        return;
    }

    try {
        textFrame.textRange.paragraphAttributes.justification = Justification.CENTER;
        return;
    } catch (justifyError) {
    }

    try {
        var paragraphs = textFrame.paragraphs;
        for (var i = 0; i < paragraphs.length; i++) {
            paragraphs[i].paragraphAttributes.justification = Justification.CENTER;
        }
    } catch (paragraphError) {
    }
}

function replaceSelectedPathGroupsMeasureTextBounds(textFrame) {
    try {
        app.redraw();
    } catch (redrawError) {
    }

    try {
        return replaceSelectedPathGroupsBoundsToObject(textFrame.visibleBounds);
    } catch (visibleBoundsError) {
        try {
            return replaceSelectedPathGroupsBoundsToObject(textFrame.geometricBounds);
        } catch (geometricBoundsError) {
            return null;
        }
    }
}

function replaceSelectedPathGroupsTextFitsGroupBounds(textBounds, groupBounds) {
    if (!textBounds || !groupBounds) {
        return false;
    }

    return textBounds.width <= groupBounds.width + 0.01 && textBounds.height <= groupBounds.height + 0.01;
}

function replaceSelectedPathGroupsFitTextSize(textFrame, targetBounds, minSize, maxSize) {
    var low = replaceSelectedPathGroupsNormalizeNumber(minSize, 1);
    var high = replaceSelectedPathGroupsNormalizeNumber(maxSize, 72);
    if (low < 1) {
        low = 1;
    }
    if (high < low) {
        high = low + 1;
    }

    var best = low;

    try {
        textFrame.textRange.characterAttributes.size = low;
    } catch (lowError) {
    }

    var lowBounds = replaceSelectedPathGroupsMeasureTextBounds(textFrame);

    if (!lowBounds) {
        return low;
    }

    if (!replaceSelectedPathGroupsTextFitsGroupBounds(lowBounds, targetBounds)) {
        return low;
    }

    var guard = 0;
    while (high < 4096) {
        try {
            textFrame.textRange.characterAttributes.size = high;
        } catch (setHighError) {
            break;
        }

        var highBounds = replaceSelectedPathGroupsMeasureTextBounds(textFrame);

        if (!highBounds || !replaceSelectedPathGroupsTextFitsGroupBounds(highBounds, targetBounds)) {
            break;
        }

        best = high;
        low = high;
        high = high * 2;
        guard++;
        if (guard > 12) {
            break;
        }
    }

    if (high > 4096) {
        high = 4096;
    }

    for (var i = 0; i < 12; i++) {
        var mid = (low + high) / 2;
        if (Math.abs(high - low) < 0.25) {
            break;
        }

        try {
            textFrame.textRange.characterAttributes.size = mid;
        } catch (midError) {
            break;
        }

        var midBounds = replaceSelectedPathGroupsMeasureTextBounds(textFrame);

        if (midBounds && replaceSelectedPathGroupsTextFitsGroupBounds(midBounds, targetBounds)) {
            best = mid;
            low = mid;
        } else {
            high = mid;
        }
    }

    try {
        textFrame.textRange.characterAttributes.size = best;
    } catch (finalSizeError) {
    }

    var safetyGuard = 0;
    while (safetyGuard < 20) {
        var safetyBounds = replaceSelectedPathGroupsMeasureTextBounds(textFrame);
        if (safetyBounds && replaceSelectedPathGroupsTextFitsGroupBounds(safetyBounds, targetBounds)) {
            break;
        }

        if (best <= 1) {
            break;
        }

        best = best * 0.85;
        if (best < 1) {
            best = 1;
        }

        try {
            textFrame.textRange.characterAttributes.size = best;
        } catch (safetySizeError) {
            break;
        }

        safetyGuard++;
    }

    return best;
}

function replaceSelectedPathGroupsGetBoundsCenter(bounds) {
    if (!bounds) {
        return {
            x: 0,
            y: 0
        };
    }

    return {
        x: bounds.left + (bounds.width / 2),
        y: bounds.top - (bounds.height / 2)
    };
}

function replaceSelectedPathGroupsGetHostContainer(item, document) {
    var current = item && item.parent ? item.parent : document;
    var guard = 0;

    while (current && guard < 100) {
        try {
            if (current.pathItems && current.textFrames) {
                return current;
            }
        } catch (error) {
        }

        if (!current.parent || current.parent === current) {
            break;
        }

        current = current.parent;
        guard++;
    }

    return document;
}

function replaceSelectedPathGroupsGetHostLayer(item, document) {
    var current = item && item.parent ? item.parent : document;
    var guard = 0;

    while (current && guard < 100) {
        try {
            if (current.typename === "Layer") {
                return current;
            }
        } catch (error) {
        }

        if (!current.parent || current.parent === current) {
            break;
        }

        current = current.parent;
        guard++;
    }

    return document;
}

function replaceSelectedPathGroupsCreateAreaTextFrame(document, groupEntry, replacementText, rotationDegrees, textSizeFactor) {
    var groupBounds = groupEntry.groupBounds;
    var hostLayer = replaceSelectedPathGroupsGetHostLayer(groupEntry.groupItem, document);
    var textFrame = null;
    var normalizedText = replaceSelectedPathGroupsNormalizeString(replacementText).replace(/\r\n|\r|\n/g, "\r");
    var angle = replaceSelectedPathGroupsNormalizeRotation(rotationDegrees);
    var fitFactor = replaceSelectedPathGroupsNormalizeFitFactor(groupEntry.fitFactor);
    var normalizedTextSizeFactor = replaceSelectedPathGroupsNormalizeTextSizeFactor(textSizeFactor);
    var fitBounds = replaceSelectedPathGroupsScaleBounds(groupBounds, fitFactor);
    var groupCenter = replaceSelectedPathGroupsGetBoundsCenter(groupBounds);

    try {
        textFrame = (hostLayer && hostLayer.textFrames ? hostLayer.textFrames : document.textFrames).pointText([groupCenter.x, groupCenter.y]);
    } catch (pointTextError) {
        throw new Error("Failed to create a point text frame for the selected path group: " + pointTextError.message);
    }

    try {
        textFrame.contents = normalizedText;
    } catch (contentError) {
        try {
            textFrame.remove();
        } catch (cleanupError) {
        }
        throw new Error("Failed to populate the replacement text: " + contentError.message);
    }

    replaceSelectedPathGroupsSetCenterJustification(textFrame);
    replaceSelectedPathGroupsApplyPathAppearance(textFrame, groupEntry.firstPath);

    try {
        if (angle !== 0 && textFrame && typeof textFrame.rotate === "function") {
            textFrame.rotate(angle, true, true, true, true, Transformation.CENTER);
        }
    } catch (textRotateError) {
    }

    var initialSize = groupBounds.height > 0 ? groupBounds.height : 12;
    if (groupBounds.width > initialSize) {
        initialSize = groupBounds.width;
    }
    if (initialSize < 1) {
        initialSize = 12;
    }

    var fittedSize = replaceSelectedPathGroupsFitTextSize(textFrame, fitBounds, 1, initialSize);
    var finalSize = fittedSize * normalizedTextSizeFactor;

    if (finalSize < 1) {
        finalSize = 1;
    }

    try {
        textFrame.textRange.characterAttributes.size = finalSize;
    } catch (finalSizeError) {
    }

    try {
        if (textFrame && typeof textFrame.zOrder === "function") {
            textFrame.zOrder(ZOrderMethod.BRINGTOFRONT);
        }
    } catch (zOrderError) {
    }

    try {
        var textBounds = null;
        try {
            textBounds = replaceSelectedPathGroupsBoundsToObject(textFrame.visibleBounds);
        } catch (visibleBoundsError) {
            textBounds = replaceSelectedPathGroupsBoundsToObject(textFrame.geometricBounds);
        }

        if (textBounds) {
            var textCenter = replaceSelectedPathGroupsGetBoundsCenter(textBounds);
            var deltaX = groupCenter.x - textCenter.x;
            var deltaY = groupCenter.y - textCenter.y;

            if (deltaX !== 0 || deltaY !== 0) {
                textFrame.translate(deltaX, deltaY);
            }
        }
    } catch (centerError) {
    }

    return textFrame;
}

function replaceSelectedPathGroupsReplaceGroupWithText(document, groupEntry, replacementText, rotationDegrees, textSizeFactor) {
    var textFrame = null;

    try {
        textFrame = replaceSelectedPathGroupsCreateAreaTextFrame(document, groupEntry, replacementText, rotationDegrees, textSizeFactor);
    } catch (creationError) {
        throw creationError;
    }

    try {
        if (groupEntry.groupItem && typeof groupEntry.groupItem.remove === "function") {
            groupEntry.groupItem.remove();
        }
    } catch (removeError) {
        try {
            if (textFrame && typeof textFrame.remove === "function") {
                textFrame.remove();
            }
        } catch (rollbackError) {
        }

        throw new Error("Failed to remove the original group after creating the replacement text: " + removeError.message);
    }

    return textFrame;
}

function replaceSelectedPathGroupsCreateGroupEntry(groupItem, displayIndex) {
    var leaves = [];
    var visited = [];
    var state = {
        invalid: false
    };

    replaceSelectedPathGroupsCollectLeafPathsFromContainer(groupItem, leaves, visited, state);

    if (state.invalid || !leaves.length) {
        return null;
    }

    for (var i = 0; i < leaves.length; i++) {
        leaves[i].collectionIndex = i;
    }

    leaves.sort(replaceSelectedPathGroupsCompareLeafOrder);

    var groupBounds = null;
    try {
        groupBounds = replaceSelectedPathGroupsGetPageItemBounds(groupItem);
    } catch (boundsError) {
        groupBounds = null;
    }

    if (!groupBounds) {
        return null;
    }

    var firstPath = leaves[0].item;
    var label = groupItem && groupItem.name ? replaceSelectedPathGroupsNormalizeString(groupItem.name) : "Group " + (displayIndex + 1);

    return {
        groupItem: groupItem,
        groupBounds: groupBounds,
        firstPath: firstPath,
        leafPaths: leaves,
        pathCount: leaves.length,
        displayIndex: displayIndex,
        entryKey: "group-" + displayIndex,
        groupLabel: label,
        previewLabel: label,
        previewSummary: leaves.length + " paths, " + groupBounds.width.toFixed(1) + " x " + groupBounds.height.toFixed(1),
        previewThumbnail: replaceSelectedPathGroupsBuildThumbnail(groupBounds)
    };
}

function replaceSelectedPathGroupsCompareEntryOrder(leftEntry, rightEntry) {
    var leftBounds = leftEntry && leftEntry.groupBounds ? leftEntry.groupBounds : null;
    var rightBounds = rightEntry && rightEntry.groupBounds ? rightEntry.groupBounds : null;
    var tolerance = 0.5;

    if (leftBounds && rightBounds) {
        if (Math.abs(leftBounds.top - rightBounds.top) > tolerance) {
            return leftBounds.top > rightBounds.top ? -1 : 1;
        }

        if (Math.abs(leftBounds.left - rightBounds.left) > tolerance) {
            return leftBounds.left < rightBounds.left ? -1 : 1;
        }
    }

    var leftIndex = typeof leftEntry.displayIndex === "number" ? leftEntry.displayIndex : 0;
    var rightIndex = typeof rightEntry.displayIndex === "number" ? rightEntry.displayIndex : 0;

    if (leftIndex < rightIndex) {
        return -1;
    }

    if (leftIndex > rightIndex) {
        return 1;
    }

    return 0;
}

function replaceSelectedPathGroupsCollectEntries() {
    var document = replaceSelectedPathGroupsGetActiveDocument();
    var selection = pathGroupNormalizeSelection(app.selection);
    var entries = [];

    if (!selection || !selection.length) {
        throw new Error("Select one or more groups that contain only paths with at least 3 anchor points before running the replacement script.");
    }

    for (var i = 0; i < selection.length; i++) {
        if (!pathGroupIsGroupItem(selection[i])) {
            continue;
        }

        if (pathGroupIsSelectedAncestorGroup(selection[i], selection)) {
            continue;
        }

        var entry = replaceSelectedPathGroupsCreateGroupEntry(selection[i], entries.length);
        if (entry) {
            entries.push(entry);
        }
    }

    entries.sort(replaceSelectedPathGroupsCompareEntryOrder);

    for (var orderIndex = 0; orderIndex < entries.length; orderIndex++) {
        entries[orderIndex].displayIndex = orderIndex;
        entries[orderIndex].displayLabel = (orderIndex + 1) + ". " + entries[orderIndex].groupLabel;
    }

    if (!entries.length) {
        throw new Error("The current selection does not contain any eligible groups made only of paths with at least 3 anchor points.");
    }

    return {
        document: document,
        entries: entries
    };
}

function replaceSelectedPathGroupsSummarizeEntries(entries) {
    var lines = [];

    for (var i = 0; i < entries.length; i++) {
        lines.push((entries[i].displayLabel ? entries[i].displayLabel : ((i + 1) + ". " + entries[i].groupLabel)) + " - " + entries[i].previewSummary);
    }

    return lines.join("\r");
}

function replaceSelectedPathGroupsClampNumber(value, minValue, maxValue) {
    var numberValue = replaceSelectedPathGroupsNormalizeNumber(value, minValue);

    if (numberValue < minValue) {
        numberValue = minValue;
    }

    if (numberValue > maxValue) {
        numberValue = maxValue;
    }

    return numberValue;
}

function replaceSelectedPathGroupsBuildThumbnail(bounds) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        return "[no preview]";
    }

    var aspect = bounds.width / bounds.height;
    if (!isFinite(aspect) || aspect <= 0) {
        aspect = 1;
    }

    var columns = Math.round(replaceSelectedPathGroupsClampNumber(aspect * 2, 3, 8));
    var rows = Math.round(replaceSelectedPathGroupsClampNumber(3 / aspect, 1, 3));
    var lines = [];
    var topBorder = "+";
    var middleFill = "|";
    var bottomBorder = "+";

    for (var i = 0; i < columns; i++) {
        topBorder += "-";
        middleFill += i % 2 === 0 ? "." : " ";
        bottomBorder += "-";
    }

    topBorder += "+";
    middleFill += "|";
    bottomBorder += "+";

    lines.push(topBorder);
    for (var j = 0; j < rows; j++) {
        lines.push(middleFill);
    }
    lines.push(bottomBorder);

    return lines.join("\r");
}

function replaceSelectedPathGroupsBuildDialogPageRanges(entries) {
    var pageSize = 6;
    var ranges = [];

    for (var i = 0; i < entries.length; i += pageSize) {
        ranges.push({
            start: i,
            end: Math.min(i + pageSize, entries.length)
        });
    }

    return ranges;
}

function replaceSelectedPathGroupsCapturePageValues(fields, fitFactorEdit, stateTable) {
    stateTable.__fitFactor = replaceSelectedPathGroupsNormalizeFitFactor(fitFactorEdit ? fitFactorEdit.text : stateTable.__fitFactor);

    for (var i = 0; i < fields.length; i++) {
        stateTable[fields[i].entryKey] = {
            replacementText: replaceSelectedPathGroupsNormalizeString(fields[i].edit.text),
            rotation: replaceSelectedPathGroupsNormalizeRotation(fields[i].rotationEdit.text)
        };
    }

    return stateTable;
}

function replaceSelectedPathGroupsBuildReplacementDialogPage(entries, pageIndex, pageCount, pageRange, stateTable) {
    var pageEntries = [];
    for (var i = pageRange.start; i < pageRange.end; i++) {
        pageEntries.push(entries[i]);
    }

    var pageLabel = "Page " + (pageIndex + 1) + " of " + pageCount;
    var win = new Window("dialog", "Replace Selected Path Groups - " + pageLabel);
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 5;
    win.spacing = 1;

    var intro = win.add("statictext", undefined, "Enter replacement text and rotation for each selected path group.");
    intro.alignment = ["fill", "top"];
    intro.preferredSize.height = 16;

    var fitRow = win.add("group");
    fitRow.orientation = "row";
    fitRow.alignChildren = ["left", "center"];
    fitRow.spacing = 4;

    fitRow.add("statictext", undefined, "Fit factor (0-1)");
    var fitFactorEdit = fitRow.add("edittext", undefined, stateTable && stateTable.__fitFactor !== undefined ? String(stateTable.__fitFactor) : "1.0");
    fitFactorEdit.characters = 8;

    var listPanel = win.add("panel", undefined, "Path group replacements");
    listPanel.orientation = "column";
    listPanel.alignChildren = ["fill", "top"];
    listPanel.margins = 3;
    listPanel.spacing = 3;

    var fields = [];

    for (var j = 0; j < pageEntries.length; j++) {
        var entry = pageEntries[j];
        var savedState = stateTable && pathGroupHasOwn(stateTable, entry.entryKey) ? stateTable[entry.entryKey] : null;

        var row = listPanel.add("panel");
        row.orientation = "column";
        row.alignChildren = ["fill", "top"];
        row.margins = 3;
        row.spacing = 2;

        var header = row.add("group");
        header.orientation = "row";
        header.alignChildren = ["left", "center"];
        header.spacing = 4;

        var preview = header.add("statictext", undefined, entry.previewThumbnail, { multiline: true });
        preview.preferredSize.width = 56;
        preview.preferredSize.height = 30;

        var details = header.add("group");
        details.orientation = "column";
        details.alignChildren = ["fill", "top"];
        details.spacing = 1;

        var labelText = entry.displayLabel ? entry.displayLabel : ((j + 1) + ". " + entry.previewLabel);
        var label = details.add("statictext", undefined, labelText);
        label.characters = 34;
        var summary = details.add("statictext", undefined, entry.previewSummary, { multiline: true });
        summary.characters = 34;

        var textLabel = row.add("statictext", undefined, "Text");
        textLabel.alignment = ["fill", "top"];
        var edit = row.add("edittext", undefined, savedState ? savedState.replacementText : "", { multiline: true });
        edit.characters = 54;
        edit.preferredSize.height = 48;

        var rotationRow = row.add("group");
        rotationRow.orientation = "row";
        rotationRow.alignChildren = ["left", "center"];
        rotationRow.spacing = 4;

        rotationRow.add("statictext", undefined, "Rotation");
        var rotationEdit = rotationRow.add("edittext", undefined, savedState ? String(savedState.rotation) : "0");
        rotationEdit.characters = 8;

        fields.push({
            entryKey: entry.entryKey,
            edit: edit,
            rotationEdit: rotationEdit
        });
    }

    var buttonGroup = win.add("group");
    buttonGroup.alignment = "right";

    var accepted = false;
    var result = null;
    var isLastPage = pageIndex === pageCount - 1;

    var previousButton = buttonGroup.add("button", undefined, "Previous");
    var nextButton = isLastPage ? buttonGroup.add("button", undefined, "Next") : buttonGroup.add("button", undefined, "Next", { name: "ok" });
    var replaceButton = isLastPage ? buttonGroup.add("button", undefined, "Replace", { name: "ok" }) : buttonGroup.add("button", undefined, "Replace");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

    previousButton.enabled = pageIndex > 0;
    nextButton.enabled = !isLastPage;
    replaceButton.enabled = isLastPage;

    previousButton.onClick = function () {
        accepted = true;
        result = {
            action: "prev",
            stateTable: replaceSelectedPathGroupsCapturePageValues(fields, fitFactorEdit, stateTable)
        };
        win.close();
    };

    nextButton.onClick = function () {
        accepted = true;
        result = {
            action: "next",
            stateTable: replaceSelectedPathGroupsCapturePageValues(fields, fitFactorEdit, stateTable)
        };
        win.close();
    };

    replaceButton.onClick = function () {
        accepted = true;
        result = {
            action: "replace",
            stateTable: replaceSelectedPathGroupsCapturePageValues(fields, fitFactorEdit, stateTable)
        };
        win.close();
    };

    cancelButton.onClick = function () {
        accepted = false;
        result = null;
        win.close();
    };

    win.center();
    win.show();

    if (!accepted) {
        return null;
    }

    return result;
}

function replaceSelectedPathGroupsBuildAllInOneTextDialog(entries, initialStateTable) {
    var stateTable = initialStateTable || {};
    var win = new Window("dialog", "Replace Selected Path Groups - All in One Text");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 5;
    win.spacing = 1;

    var intro = win.add("statictext", undefined, "Enter one replacement text and rotation to apply to all selected path groups.");
    intro.alignment = ["fill", "top"];
    intro.preferredSize.height = 16;

    var summary = win.add("statictext", undefined, "Selected groups: " + entries.length);
    summary.alignment = ["fill", "top"];

    var textLabel = win.add("statictext", undefined, "Replacement text");
    textLabel.alignment = ["fill", "top"];
    var textEdit = win.add("edittext", undefined, stateTable.__allInOneReplacementText !== undefined ? stateTable.__allInOneReplacementText : "", { multiline: true });
    textEdit.characters = 54;
    textEdit.preferredSize.height = 96;

    var rotationRow = win.add("group");
    rotationRow.orientation = "row";
    rotationRow.alignChildren = ["left", "center"];
    rotationRow.spacing = 4;

    rotationRow.add("statictext", undefined, "Rotation");
    var rotationEdit = rotationRow.add("edittext", undefined, stateTable.__allInOneRotation !== undefined ? String(stateTable.__allInOneRotation) : "0");
    rotationEdit.characters = 8;

    var sizeRow = win.add("group");
    sizeRow.orientation = "row";
    sizeRow.alignChildren = ["left", "center"];
    sizeRow.spacing = 4;

    sizeRow.add("statictext", undefined, "Text size factor (0+)");
    var sizeFactorEdit = sizeRow.add("edittext", undefined, stateTable.__allInOneTextSizeFactor !== undefined ? String(stateTable.__allInOneTextSizeFactor) : "1.0");
    sizeFactorEdit.characters = 8;

    var buttonGroup = win.add("group");
    buttonGroup.alignment = "right";

    var accepted = false;
    var result = null;

    var replaceButton = buttonGroup.add("button", undefined, "Replace", { name: "ok" });
    var cancelButton = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

    replaceButton.onClick = function () {
        accepted = true;
        result = {
            replacementText: replaceSelectedPathGroupsNormalizeString(textEdit.text),
            rotation: replaceSelectedPathGroupsNormalizeRotation(rotationEdit.text),
            textSizeFactor: replaceSelectedPathGroupsNormalizeTextSizeFactor(sizeFactorEdit.text)
        };
        win.close();
    };

    cancelButton.onClick = function () {
        accepted = false;
        result = null;
        win.close();
    };

    win.center();
    win.show();

    if (!accepted) {
        return null;
    }

    return result;
}

function replaceSelectedPathGroupsBuildReplacementDialog(entries, initialStateTable) {
    var pageRanges = replaceSelectedPathGroupsBuildDialogPageRanges(entries);
    var stateTable = initialStateTable || {};
    if (stateTable.__fitFactor === undefined || stateTable.__fitFactor === null) {
        stateTable.__fitFactor = 1.0;
    }
    var currentPage = 0;

    while (currentPage >= 0 && currentPage < pageRanges.length) {
        var pageResult = replaceSelectedPathGroupsBuildReplacementDialogPage(entries, currentPage, pageRanges.length, pageRanges[currentPage], stateTable);

        if (!pageResult) {
            return null;
        }

        stateTable = pageResult.stateTable;

        if (pageResult.action === "prev") {
            currentPage--;
            continue;
        }

        if (pageResult.action === "next") {
            currentPage++;
            continue;
        }

        break;
    }

    return stateTable;
}

function replaceSelectedPathGroupsRunAllInOneText() {
    var collected = replaceSelectedPathGroupsCollectEntries();
    var dialogResult = replaceSelectedPathGroupsBuildAllInOneTextDialog(collected.entries, null);

    if (!dialogResult) {
        return "Path-group replacement cancelled by user.";
    }

    for (var i = 0; i < collected.entries.length; i++) {
        collected.entries[i].replacementText = dialogResult.replacementText;
        collected.entries[i].rotation = dialogResult.rotation;
        collected.entries[i].fitFactor = 1.0;
        collected.entries[i].textSizeFactor = dialogResult.textSizeFactor;
    }

    var result = replaceSelectedPathGroupsApplyEntries(collected.document, collected.entries);
    return "Replaced " + result.appliedCount + " selected path group(s) with all-in-one text; skipped " + result.skippedCount + ".";
}

function replaceSelectedPathGroupsRunInteractive() {
    var collected = replaceSelectedPathGroupsCollectEntries();
    var stateTable = replaceSelectedPathGroupsBuildReplacementDialog(collected.entries, null);

    if (!stateTable) {
        return "Path-group replacement cancelled by user.";
    }

    for (var i = 0; i < collected.entries.length; i++) {
        var entry = collected.entries[i];
        var state = stateTable[entry.entryKey];

        entry.fitFactor = replaceSelectedPathGroupsNormalizeFitFactor(stateTable.__fitFactor);

        if (state) {
            entry.replacementText = state.replacementText;
            entry.rotation = state.rotation;
        } else {
            entry.replacementText = "";
            entry.rotation = 0;
        }
    }

    var result = replaceSelectedPathGroupsApplyEntries(collected.document, collected.entries);
    return "Replaced " + result.appliedCount + " selected path group(s); skipped " + result.skippedCount + ".";
}

function replaceSelectedPathGroupsApplyEntries(document, entries) {
    var appliedCount = 0;
    var skippedCount = 0;

    for (var i = 0; i < entries.length; i++) {
        var replacementText = replaceSelectedPathGroupsNormalizeString(entries[i].replacementText);
        var rotation = replaceSelectedPathGroupsNormalizeRotation(entries[i].rotation);
        var textSizeFactor = replaceSelectedPathGroupsNormalizeTextSizeFactor(entries[i].textSizeFactor);

        if (!replacementText.length) {
            skippedCount++;
            continue;
        }

        try {
            replaceSelectedPathGroupsReplaceGroupWithText(document, entries[i], replacementText, rotation, textSizeFactor);
            appliedCount++;
        } catch (error) {
            throw new Error("Failed to replace group #" + (i + 1) + ": " + error.message);
        }
    }

    return {
        appliedCount: appliedCount,
        skippedCount: skippedCount
    };
}
