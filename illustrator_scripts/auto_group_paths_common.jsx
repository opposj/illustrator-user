/*
 * Shared utilities for auto-grouping nearby path and compound path objects in Illustrator.
 * This library collects atomic PathItem and CompoundPathItem objects from the current
 * selection or the entire document, filters them by an optional area range and a configurable
 * fill-color/no-stroke appearance prefilter, clusters nearby items by independently scaled
 * width/height bounding-box overlap, then subdivides each rough cluster by median-relative
 * center-line alignment before rebuilding the result as path-aware groups.
 */

function pathGroupGetActiveDocument() {
    if (app.documents.length === 0) {
        throw new Error("Open a document before running the path auto-grouping script.");
    }

    return app.activeDocument;
}

function pathGroupHasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function pathGroupIsPathItem(item) {
    return item && item.typename === "PathItem";
}

function pathGroupIsCompoundPathItem(item) {
    return item && item.typename === "CompoundPathItem";
}

function pathGroupIsGroupItem(item) {
    return item && item.typename === "GroupItem";
}

function pathGroupArrayContains(items, item) {
    for (var i = items.length - 1; i >= 0; i--) {
        if (items[i] === item) {
            return true;
        }
    }

    return false;
}

function pathGroupNormalizeSelection(selection) {
    if (!selection) {
        return [];
    }

    if (selection.typename) {
        return [selection];
    }

    if (typeof selection.length === "number") {
        return selection;
    }

    return [selection];
}

function pathGroupClearSelection(document) {
    try {
        document.selection = null;
    } catch (documentSelectionError) {
        // Ignore failures and fall back to the application selection below.
    }

    try {
        app.selection = null;
    } catch (appSelectionError) {
        // Ignore failures; the document selection clear above is the primary path.
    }
}

function pathGroupSelectCreatedGroups(document, results) {
    var selectedGroups = [];
    var selectedCount = 0;
    var skippedCount = 0;

    for (var i = 0; i < results.length; i++) {
        if (results[i] && results[i].grouped && results[i].group) {
            selectedGroups.push(results[i].group);
        }
    }

    pathGroupClearSelection(document);

    for (var j = 0; j < selectedGroups.length; j++) {
        try {
            selectedGroups[j].selected = true;
            selectedCount++;
        } catch (selectionError) {
            skippedCount++;
        }
    }

    return {
        selectedCount: selectedCount,
        skippedCount: skippedCount
    };
}

function pathGroupIsSelectedAncestorGroup(item, selection) {
    var current = item;
    var guard = 0;

    while (current && current.parent && current.parent !== current && guard < 50) {
        current = current.parent;
        if (pathGroupIsGroupItem(current) && pathGroupArrayContains(selection, current)) {
            return true;
        }
        guard++;
    }

    return false;
}

function pathGroupBoundsFromArray(bounds) {
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

function pathGroupGetItemBounds(item) {
    if (!item) {
        return null;
    }

    try {
        return pathGroupBoundsFromArray(item.geometricBounds);
    } catch (geometricError) {
        try {
            return pathGroupBoundsFromArray(item.controlBounds);
        } catch (controlError) {
            return null;
        }
    }
}

function pathGroupNormalizeScaleFactor(value) {
    var factor = typeof value === "number" ? value : 1.0;

    if (isNaN(factor) || factor <= 0) {
        factor = 1.0;
    }

    return factor;
}

function pathGroupScaleBounds(bounds, widthScaleFactor, heightScaleFactor) {
    if (!bounds) {
        return null;
    }

    var widthFactor = pathGroupNormalizeScaleFactor(widthScaleFactor);
    var heightFactor = typeof heightScaleFactor === "number" ? heightScaleFactor : widthFactor;

    if (isNaN(heightFactor) || heightFactor <= 0) {
        heightFactor = 1.0;
    }

    var squareSize = bounds.width > bounds.height ? bounds.width : bounds.height;
    var scaledWidth = squareSize * widthFactor;
    var scaledHeight = squareSize * heightFactor;

    return {
        left: bounds.centerX - (scaledWidth / 2),
        top: bounds.centerY + (scaledHeight / 2),
        right: bounds.centerX + (scaledWidth / 2),
        bottom: bounds.centerY - (scaledHeight / 2),
        width: scaledWidth,
        height: scaledHeight,
        centerX: bounds.centerX,
        centerY: bounds.centerY
    };
}

function pathGroupBoundsOverlap(leftBounds, rightBounds) {
    if (!leftBounds || !rightBounds) {
        return false;
    }

    var tolerance = 0.001;
    return !(
        leftBounds.right < rightBounds.left - tolerance ||
        rightBounds.right < leftBounds.left - tolerance ||
        leftBounds.top < rightBounds.bottom - tolerance ||
        rightBounds.top < leftBounds.bottom - tolerance
    );
}

function pathGroupGetItemArea(bounds) {
    if (!bounds) {
        return 0;
    }

    var width = bounds.width > 0 ? bounds.width : 0;
    var height = bounds.height > 0 ? bounds.height : 0;
    return width * height;
}

function pathGroupNormalizeAreaRange(areaRangeMin, areaRangeMax) {
    var hasMin = typeof areaRangeMin === "number" && !isNaN(areaRangeMin);
    var hasMax = typeof areaRangeMax === "number" && !isNaN(areaRangeMax);

    if (!hasMin || !hasMax) {
        return null;
    }

    if (areaRangeMin > areaRangeMax) {
        var swap = areaRangeMin;
        areaRangeMin = areaRangeMax;
        areaRangeMax = swap;
    }

    return {
        min: areaRangeMin,
        max: areaRangeMax
    };
}

function pathGroupAreaInRange(area, areaRange) {
    if (!areaRange) {
        return true;
    }

    return area >= areaRange.min && area <= areaRange.max;
}

function pathGroupGetAppearanceTarget(item) {
    if (!item) {
        return null;
    }

    if (pathGroupIsCompoundPathItem(item)) {
        try {
            if (typeof item.fillColor !== "undefined") {
                return item;
            }
        } catch (compoundAppearanceError) {
            // Fall back to a child path below.
        }

        try {
            if (item.pathItems && item.pathItems.length) {
                return item.pathItems[0];
            }
        } catch (compoundPathItemsError) {
            return item;
        }
    }

    return item;
}

function pathGroupIsZeroNumber(value) {
    return typeof value === "number" && !isNaN(value) && Math.abs(value) < 0.0001;
}

function pathGroupIsHundredNumber(value) {
    return typeof value === "number" && !isNaN(value) && Math.abs(value - 100) < 0.0001;
}

function pathGroupIsBlackColor(color) {
    if (!color) {
        return false;
    }

    try {
        if (color.typename === "RGBColor") {
            return pathGroupIsZeroNumber(color.red) && pathGroupIsZeroNumber(color.green) && pathGroupIsZeroNumber(color.blue);
        }

        if (color.typename === "CMYKColor") {
            return pathGroupIsZeroNumber(color.cyan) && pathGroupIsZeroNumber(color.magenta) && pathGroupIsZeroNumber(color.yellow) && pathGroupIsHundredNumber(color.black);
        }

        if (color.typename === "GrayColor") {
            return pathGroupIsHundredNumber(color.gray);
        }
    } catch (colorError) {
        return false;
    }

    return false;
}

function pathGroupClampByte(value) {
    var number = typeof value === "number" && !isNaN(value) ? value : 0;

    if (number < 0) {
        number = 0;
    }

    if (number > 255) {
        number = 255;
    }

    return Math.round(number);
}

function pathGroupByteToHex(value) {
    var hex = pathGroupClampByte(value).toString(16).toUpperCase();

    if (hex.length < 2) {
        hex = "0" + hex;
    }

    return hex;
}

function pathGroupClampPercent(value) {
    var number = typeof value === "number" && !isNaN(value) ? value : 0;

    if (number < 0) {
        number = 0;
    }

    if (number > 100) {
        number = 100;
    }

    return number;
}

function pathGroupPercentToByte(value) {
    var number = pathGroupClampPercent(value);

    return Math.round((1 - (number / 100)) * 255);
}

function pathGroupNormalizeFillColorLimit(value) {
    var limit = typeof value === "string" ? value : "#000000";

    limit = limit.replace(/^\s+|\s+$/g, "");
    if (!limit) {
        limit = "#000000";
    }

    if (limit.charAt(0) !== "#" && /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(limit)) {
        limit = "#" + limit;
    }

    if (/^#[0-9a-fA-F]{3}$/.test(limit)) {
        limit = "#" + limit.charAt(1) + limit.charAt(1) + limit.charAt(2) + limit.charAt(2) + limit.charAt(3) + limit.charAt(3);
    }

    return limit.toUpperCase();
}

function pathGroupColorToHex(color) {
    if (!color) {
        return null;
    }

    try {
        if (color.typename === "RGBColor") {
            return "#" + pathGroupByteToHex(color.red) + pathGroupByteToHex(color.green) + pathGroupByteToHex(color.blue);
        }

        if (color.typename === "CMYKColor") {
            var cyan = pathGroupClampPercent(color.cyan) / 100;
            var magenta = pathGroupClampPercent(color.magenta) / 100;
            var yellow = pathGroupClampPercent(color.yellow) / 100;
            var black = pathGroupClampPercent(color.black) / 100;
            var red = 255 * (1 - cyan) * (1 - black);
            var green = 255 * (1 - magenta) * (1 - black);
            var blue = 255 * (1 - yellow) * (1 - black);
            return "#" + pathGroupByteToHex(red) + pathGroupByteToHex(green) + pathGroupByteToHex(blue);
        }

        if (color.typename === "GrayColor") {
            var gray = pathGroupPercentToByte(color.gray);
            return "#" + pathGroupByteToHex(gray) + pathGroupByteToHex(gray) + pathGroupByteToHex(gray);
        }
    } catch (describeError) {
        return null;
    }

    return null;
}

function pathGroupIsFillColorWithinLimit(color, fillColorLimit) {
    var limit = pathGroupNormalizeFillColorLimit(fillColorLimit);
    var actualColor = pathGroupColorToHex(color);

    if (!actualColor) {
        return false;
    }

    return actualColor === limit;
}

function pathGroupHasBlackFillAndNoStroke(item, fillColorLimit) {
    var appearanceTarget = pathGroupGetAppearanceTarget(item);

    if (!appearanceTarget) {
        return false;
    }

    try {
        if (appearanceTarget.filled === false) {
            return false;
        }
    } catch (filledError) {
        // Ignore missing filled checks and continue with fill color validation below.
    }

    try {
        if (!pathGroupIsFillColorWithinLimit(appearanceTarget.fillColor, fillColorLimit)) {
            return false;
        }
    } catch (filledError) {
        return false;
    }

    try {
        if (appearanceTarget.stroked === true) {
            return false;
        }
    } catch (strokedError) {
        // Ignore missing stroked checks and fall through to the weight check below.
    }

    try {
        if (typeof appearanceTarget.strokeWeight === "number" && appearanceTarget.strokeWeight > 0) {
            return false;
        }
    } catch (strokeWeightError) {
        // Ignore missing stroke-weight checks and keep the appearance prefilter permissive.
    }

    return true;
}

function pathGroupCanEditItem(item) {
    if (!item) {
        return false;
    }

    try {
        if (item.editable === false) {
            return false;
        }
    } catch (editableError) {
        // Ignore missing editable checks and continue.
    }

    try {
        if (item.locked) {
            return false;
        }
    } catch (lockedError) {
        // Ignore missing locked checks and continue.
    }

    try {
        if (item.hidden) {
            return false;
        }
    } catch (hiddenError) {
        // Ignore missing hidden checks and continue.
    }

    return true;
}

function pathGroupPromoteGroupVisibility(groupItem) {
    if (!groupItem) {
        return false;
    }

    var promoted = false;
    var current = groupItem;

    while (current) {
        try {
            if (typeof current.zOrder === "function") {
                current.zOrder(ZOrderMethod.BRINGTOFRONT);
                promoted = true;
            }
        } catch (zOrderError) {
            // Ignore stacking-order failures and keep walking upward.
        }

        try {
            current = current.parent;
        } catch (parentError) {
            current = null;
        }

        if (!current || current === groupItem) {
            break;
        }

        if (current.typename !== "GroupItem" && current.typename !== "Layer") {
            break;
        }

        if (current.typename === "Layer") {
            try {
                if (typeof current.zOrder === "function") {
                    current.zOrder(ZOrderMethod.BRINGTOFRONT);
                    promoted = true;
                }
            } catch (layerZOrderError) {
                // Ignore layer promotion failures as well.
            }
            break;
        }
    }

    try {
        groupItem.zOrder(ZOrderMethod.BRINGTOFRONT);
        promoted = true;
    } catch (groupZOrderError) {
        // Ignore stacking-order failures and keep the regrouping result intact.
    }

    return promoted;
}

function pathGroupPromoteLayerVisibility(layerItem) {
    if (!layerItem) {
        return false;
    }

    try {
        if (typeof layerItem.zOrder === "function") {
            layerItem.zOrder(ZOrderMethod.BRINGTOFRONT);
            return true;
        }
    } catch (zOrderError) {
        // Ignore layer stacking failures and keep the regrouping result intact.
    }

    return false;
}

function pathGroupFindVisibilityHostLayer(container, document) {
    var current = container;
    var guard = 0;

    while (current && guard < 100) {
        if (current.typename === "Layer") {
            return current;
        }

        if (current === document) {
            break;
        }

        try {
            if (!current.parent || current.parent === current) {
                break;
            }
            current = current.parent;
        } catch (parentError) {
            current = null;
            break;
        }

        guard++;
    }

    try {
        if (document.activeLayer && document.activeLayer.typename === "Layer") {
            return document.activeLayer;
        }
    } catch (activeLayerError) {
        // Ignore active layer lookup failures and keep falling back.
    }

    try {
        if (document.layers && document.layers.length) {
            for (var i = 0; i < document.layers.length; i++) {
                if (document.layers[i] && document.layers[i].typename === "Layer") {
                    return document.layers[i];
                }
            }
        }
    } catch (layersError) {
        // Ignore document layer traversal failures and fall back below.
    }

    return document;
}

function pathGroupGetAncestorChain(item, document) {
    var chain = [];
    var current = item;
    var guard = 0;
    var reachedDocument = false;

    while (current && guard < 100) {
        chain.push(current);
        if (current === document) {
            reachedDocument = true;
            break;
        }
        if (!current.parent || current.parent === current) {
            break;
        }
        current = current.parent;
        guard++;
    }

    if (document && !reachedDocument) {
        chain.push(document);
    }

    chain.reverse();
    return chain;
}

function pathGroupFindCommonAncestor(entries, document) {
    if (!entries.length) {
        return document;
    }

    if (entries.length === 1) {
        var singleChain = pathGroupGetAncestorChain(entries[0].parent, document);
        return singleChain.length ? singleChain[singleChain.length - 1] : document;
    }

    var chains = [];
    var shortestIndex = 0;
    var shortestLength = 0;
    var i;

    for (i = 0; i < entries.length; i++) {
        var chain = pathGroupGetAncestorChain(entries[i].parent, document);
        chains.push(chain);

        if (i === 0 || chain.length < shortestLength) {
            shortestIndex = i;
            shortestLength = chain.length;
        }
    }

    var firstChain = chains[shortestIndex];

    for (i = 0; i < firstChain.length; i++) {
        var candidate = firstChain[i];
        var matchesAll = true;

        for (var j = 0; j < chains.length; j++) {
            if (j === shortestIndex) {
                continue;
            }

            if (chains[j][i] !== candidate) {
                matchesAll = false;
                break;
            }
        }

        if (matchesAll) {
            return candidate;
        }
    }

    return firstChain.length ? firstChain[0] : document;
}

function pathGroupCompareVisualOrder(leftEntry, rightEntry) {
    var leftBounds = leftEntry && leftEntry.bounds ? leftEntry.bounds : null;
    var rightBounds = rightEntry && rightEntry.bounds ? rightEntry.bounds : null;
    var leftTop = leftBounds ? leftBounds.top : 0;
    var rightTop = rightBounds ? rightBounds.top : 0;
    var tolerance = 0.5;

    if (Math.abs(leftTop - rightTop) > tolerance) {
        return leftTop > rightTop ? -1 : 1;
    }

    var leftLeft = leftBounds ? leftBounds.left : 0;
    var rightLeft = rightBounds ? rightBounds.left : 0;

    if (Math.abs(leftLeft - rightLeft) > tolerance) {
        return leftLeft < rightLeft ? -1 : 1;
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

function pathGroupFindCompoundPathAncestor(item) {
    var current = item;
    var guard = 0;

    while (current && guard < 50) {
        try {
            current = current.parent;
        } catch (parentError) {
            return null;
        }

        if (!current) {
            break;
        }

        if (pathGroupIsCompoundPathItem(current)) {
            return current;
        }

        if (!current.parent || current.parent === current) {
            break;
        }

        guard++;
    }

    return null;
}

function pathGroupResolveAtomicItem(item) {
    if (!item) {
        return null;
    }

    if (pathGroupIsCompoundPathItem(item)) {
        return item;
    }

    if (pathGroupIsPathItem(item)) {
        var compoundAncestor = pathGroupFindCompoundPathAncestor(item);
        if (compoundAncestor) {
            return compoundAncestor;
        }
        return item;
    }

    return null;
}

function pathGroupSnapshotItem(item) {
    var atomicItem = pathGroupResolveAtomicItem(item);
    if (!atomicItem) {
        return null;
    }

    var bounds = pathGroupGetItemBounds(atomicItem);
    if (!bounds) {
        return null;
    }

    return {
        item: atomicItem,
        parent: atomicItem.parent,
        bounds: bounds,
        area: pathGroupGetItemArea(bounds)
    };
}

function pathGroupHasEntryForItem(entries, item) {
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].item === item) {
            return true;
        }
    }

    return false;
}

function pathGroupCreateEntryFromItem(item, areaRange, fillColorLimit) {
    var snapshot = pathGroupSnapshotItem(item);
    if (!snapshot) {
        return null;
    }

    if (!pathGroupAreaInRange(snapshot.area, areaRange)) {
        return null;
    }

    if (!pathGroupHasBlackFillAndNoStroke(snapshot.item, fillColorLimit)) {
        return null;
    }

    return {
        item: snapshot.item,
        parent: snapshot.parent,
        bounds: snapshot.bounds,
        area: snapshot.area,
        scaledLeft: 0,
        scaledTop: 0,
        scaledRight: 0,
        scaledBottom: 0,
        collectionIndex: 0
    };
}

function pathGroupCollectEntriesFromContainer(item, entries, visitedContainers, visitedAtomic, areaRange, fillColorLimit) {
    var stack = [item];

    while (stack.length) {
        var current = stack.pop();
        if (!current || pathGroupArrayContains(visitedContainers, current) || pathGroupArrayContains(visitedAtomic, current)) {
            continue;
        }

        if (pathGroupIsPathItem(current) || pathGroupIsCompoundPathItem(current)) {
            var entry = pathGroupCreateEntryFromItem(current, areaRange, fillColorLimit);
            if (entry) {
                if (pathGroupArrayContains(visitedAtomic, entry.item)) {
                    continue;
                }

                visitedAtomic.push(entry.item);
                entries.push(entry);
            }
            continue;
        }

        visitedContainers.push(current);

        try {
            if (current.layers && current.layers.length) {
                for (var i = current.layers.length - 1; i >= 0; i--) {
                    stack.push(current.layers[i]);
                }
            }
        } catch (layerError) {
            // Ignore nested layer traversal failures.
        }

        try {
            if (current.pageItems && current.pageItems.length) {
                for (var j = current.pageItems.length - 1; j >= 0; j--) {
                    stack.push(current.pageItems[j]);
                }
            }
        } catch (pageItemError) {
            // Ignore nested page item traversal failures.
        }
    }
}

function pathGroupCollectEntries(areaRangeMinInput, areaRangeMaxInput, fillColorLimitInput) {
    var document = pathGroupGetActiveDocument();
    var selection = pathGroupNormalizeSelection(app.selection);
    var roots = [];
    var areaRange = pathGroupNormalizeAreaRange(areaRangeMinInput, areaRangeMaxInput);
    var fillColorLimit = pathGroupNormalizeFillColorLimit(fillColorLimitInput);
    var i;

    if (!(selection && selection.length)) {
        var documentEntries = [];
        try {
            if (document.pageItems && document.pageItems.length) {
                for (i = 0; i < document.pageItems.length; i++) {
                    var documentEntry = pathGroupCreateEntryFromItem(document.pageItems[i], areaRange, fillColorLimit);
                    if (documentEntry) {
                        if (pathGroupHasEntryForItem(documentEntries, documentEntry.item)) {
                            continue;
                        }

                        documentEntries.push(documentEntry);
                    }
                }
            }
        } catch (documentPageItemError) {
            // Fall back to the recursive walk below if the direct page-item scan fails.
        }

        if (documentEntries.length) {
            for (i = 0; i < documentEntries.length; i++) {
                documentEntries[i].collectionIndex = i;
            }

            documentEntries.sort(pathGroupCompareVisualOrder);
            return documentEntries;
        }

        roots = [document];
    } else {
        roots = selection;
    }

    var entries = [];
    var visitedContainers = [];
    var visitedAtomic = [];

    for (i = 0; i < roots.length; i++) {
        if (selection && selection.length && !pathGroupIsGroupItem(roots[i]) && pathGroupIsSelectedAncestorGroup(roots[i], selection)) {
            continue;
        }

        pathGroupCollectEntriesFromContainer(roots[i], entries, visitedContainers, visitedAtomic, areaRange, fillColorLimit);
    }

    if (!entries.length) {
        throw new Error("The current scope does not contain any path or compound path objects matching the area and appearance filters.");
    }

    for (var j = 0; j < entries.length; j++) {
        entries[j].collectionIndex = j;
    }

    entries.sort(pathGroupCompareVisualOrder);
    return entries;
}

function pathGroupBuildOverlapClusters(entries, widthScaleFactor, heightScaleFactor) {
    var total = entries.length;
    var parent = [];
    var rank = [];
    var sortedIndices = [];
    var i;

    for (i = 0; i < total; i++) {
        parent[i] = i;
        rank[i] = 0;
        var bounds = entries[i].bounds;
        var scaledBounds = pathGroupScaleBounds(bounds, widthScaleFactor, heightScaleFactor);
        entries[i].scaledLeft = scaledBounds.left;
        entries[i].scaledTop = scaledBounds.top;
        entries[i].scaledRight = scaledBounds.right;
        entries[i].scaledBottom = scaledBounds.bottom;
        sortedIndices.push(i);
    }

    sortedIndices.sort(function (leftIndex, rightIndex) {
        var leftBoundsLeft = entries[leftIndex].scaledLeft;
        var rightBoundsLeft = entries[rightIndex].scaledLeft;
        var leftBoundsTop = entries[leftIndex].scaledTop;
        var rightBoundsTop = entries[rightIndex].scaledTop;

        if (leftBoundsLeft < rightBoundsLeft) {
            return -1;
        }

        if (leftBoundsLeft > rightBoundsLeft) {
            return 1;
        }

        if (leftBoundsTop > rightBoundsTop) {
            return -1;
        }

        if (leftBoundsTop < rightBoundsTop) {
            return 1;
        }

        if (leftIndex < rightIndex) {
            return -1;
        }

        if (leftIndex > rightIndex) {
            return 1;
        }

        return 0;
    });

    function find(index) {
        if (parent[index] !== index) {
            parent[index] = find(parent[index]);
        }

        return parent[index];
    }

    function union(leftIndex, rightIndex) {
        var leftRoot = find(leftIndex);
        var rightRoot = find(rightIndex);

        if (leftRoot === rightRoot) {
            return;
        }

        if (rank[leftRoot] < rank[rightRoot]) {
            parent[leftRoot] = rightRoot;
        } else if (rank[leftRoot] > rank[rightRoot]) {
            parent[rightRoot] = leftRoot;
        } else {
            parent[rightRoot] = leftRoot;
            rank[leftRoot]++;
        }
    }

    var activeIndices = [];
    var nextActiveIndices = [];
    var overlapTolerance = 0.001;

    for (i = 0; i < sortedIndices.length; i++) {
        var currentIndex = sortedIndices[i];
        var currentBoundsLeft = entries[currentIndex].scaledLeft;
        var currentBoundsTop = entries[currentIndex].scaledTop;
        var currentBoundsRight = entries[currentIndex].scaledRight;
        var currentBoundsBottom = entries[currentIndex].scaledBottom;
        var minimumRight = currentBoundsLeft - overlapTolerance;
        nextActiveIndices.length = 0;

        for (var j = 0; j < activeIndices.length; j++) {
            var activeIndex = activeIndices[j];
            var activeBoundsLeft = entries[activeIndex].scaledLeft;
            var activeBoundsTop = entries[activeIndex].scaledTop;
            var activeBoundsRight = entries[activeIndex].scaledRight;
            var activeBoundsBottom = entries[activeIndex].scaledBottom;

            if (activeBoundsRight >= minimumRight) {
                if (!(
                    currentBoundsRight < activeBoundsLeft - overlapTolerance ||
                    activeBoundsRight < currentBoundsLeft - overlapTolerance ||
                    currentBoundsTop < activeBoundsBottom - overlapTolerance ||
                    activeBoundsTop < currentBoundsBottom - overlapTolerance
                )) {
                    union(currentIndex, activeIndex);
                }

                nextActiveIndices[nextActiveIndices.length] = activeIndex;
            }
        }

        var swapActive = activeIndices;
        activeIndices = nextActiveIndices;
        nextActiveIndices = swapActive;
        activeIndices[activeIndices.length] = currentIndex;
    }

    var clusterMap = [];
    var clusterOrder = [];

    for (i = 0; i < total; i++) {
        var root = find(i);
        if (!clusterMap[root]) {
            clusterMap[root] = [];
            clusterOrder.push(root);
        }
        clusterMap[root].push(entries[i]);
    }

    var clusters = [];
    for (var k = 0; k < clusterOrder.length; k++) {
        var cluster = clusterMap[clusterOrder[k]];
        cluster.sort(pathGroupCompareVisualOrder);
        clusters.push(cluster);
    }

    clusters.sort(function (leftCluster, rightCluster) {
        return pathGroupCompareVisualOrder(leftCluster[0], rightCluster[0]);
    });

    return clusters;
}

function pathGroupBuildClusters(entries, widthScaleFactor, heightScaleFactor) {
    return pathGroupBuildOverlapClusters(entries, widthScaleFactor, heightScaleFactor);
}

function pathGroupApplyCluster(document, cluster) {
    if (cluster.length < 1) {
        return {
            grouped: false,
            moved: 0,
            skipped: true,
            reason: "empty_cluster"
        };
    }

    for (var i = 0; i < cluster.length; i++) {
        if (!pathGroupCanEditItem(cluster[i].item)) {
            return {
                grouped: false,
                moved: 0,
                skipped: true,
                reason: "locked_or_hidden"
            };
        }
    }

    var targetContainer;
    if (cluster.length === 1) {
        targetContainer = cluster[0].parent || document;
    } else {
        var firstParent = cluster[0].parent;
        var sameParent = true;

        for (var j = 1; j < cluster.length; j++) {
            if (cluster[j].parent !== firstParent) {
                sameParent = false;
                break;
            }
        }

        if (sameParent) {
            targetContainer = firstParent || document;
        } else {
            targetContainer = pathGroupFindCommonAncestor(cluster, document);
        }
    }
    if (!targetContainer || !targetContainer.groupItems) {
        targetContainer = document;
    }

    var visibilityHost = pathGroupFindVisibilityHostLayer(targetContainer, document);
    if (!visibilityHost || !visibilityHost.groupItems) {
        visibilityHost = targetContainer;
    }

    var newGroup = null;
    try {
        newGroup = visibilityHost.groupItems.add();
    } catch (createError) {
        throw new Error("Failed to create a group for nearby path items: " + createError.message);
    }

    var movedCount = 0;
    var failedItems = [];

    for (var j = 0; j < cluster.length; j++) {
        var item = cluster[j].item;
        var moved = false;

        try {
            item.move(newGroup, ElementPlacement.PLACEATEND);
            moved = true;
        } catch (moveError) {
            try {
                item.duplicate(newGroup, ElementPlacement.PLACEATEND);
                item.remove();
                moved = true;
            } catch (duplicateError) {
                moved = false;
            }
        }

        if (moved) {
            movedCount++;
        } else {
            failedItems.push(item);
        }
    }

    var requiredMovableCount = cluster.length === 1 ? 1 : 2;

    if (movedCount < requiredMovableCount) {
        try {
            newGroup.remove();
        } catch (cleanupError) {
            // Ignore cleanup failures after a partial regroup attempt.
        }

        return {
            grouped: false,
            moved: movedCount,
            skipped: true,
            reason: cluster.length === 1 ? "single_item_unmovable" : "insufficient_movable_items"
        };
    }

    pathGroupPromoteLayerVisibility(visibilityHost);
    pathGroupPromoteGroupVisibility(newGroup);

    return {
        grouped: true,
        moved: movedCount,
        skipped: false,
        failedItems: failedItems,
        group: newGroup
    };
}

function pathGroupSummarizeResults(results, selectionResult) {
    var groupedClusters = 0;
    var movedItems = 0;
    var skippedClusters = 0;

    for (var i = 0; i < results.length; i++) {
        if (results[i].grouped) {
            groupedClusters++;
            movedItems += results[i].moved;
        } else if (results[i].skipped) {
            skippedClusters++;
        }
    }

    if (groupedClusters === 0) {
        return "No centered path items required regrouping." + (selectionResult ? " Cleared selection." : "");
    }

    var summary = "Auto-grouped " + movedItems + " path item(s) into " + groupedClusters + " dilation group(s).";
    if (selectionResult) {
        summary += " Selected " + selectionResult.selectedCount + " group(s).";
        if (selectionResult.skippedCount > 0) {
            summary += " Skipped " + selectionResult.skippedCount + " group(s) that could not be selected.";
        }
    }

    return summary;
}

function pathGroupRunHeadless(widthScaleFactorInput, heightScaleFactorInput, fillColorLimitInput, areaRangeMinInput, areaRangeMaxInput) {
    var document = pathGroupGetActiveDocument();
    var entries;
    var widthScaleFactor;
    var heightScaleFactor;
    var fillColorLimit;
    var areaMin;
    var areaMax;

    if (arguments.length >= 5) {
        widthScaleFactor = pathGroupNormalizeScaleFactor(widthScaleFactorInput);
        heightScaleFactor = pathGroupNormalizeScaleFactor(heightScaleFactorInput);
        fillColorLimit = pathGroupNormalizeFillColorLimit(fillColorLimitInput);
        areaMin = areaRangeMinInput;
        areaMax = areaRangeMaxInput;
    } else if (arguments.length === 4) {
        widthScaleFactor = pathGroupNormalizeScaleFactor(widthScaleFactorInput);
        heightScaleFactor = pathGroupNormalizeScaleFactor(heightScaleFactorInput);
        fillColorLimit = "#000000";
        areaMin = fillColorLimitInput;
        areaMax = areaRangeMinInput;
    } else if (arguments.length === 3) {
        widthScaleFactor = pathGroupNormalizeScaleFactor(widthScaleFactorInput);
        heightScaleFactor = widthScaleFactor;
        fillColorLimit = "#000000";
        areaMin = heightScaleFactorInput;
        areaMax = areaRangeMinInput;
    } else {
        widthScaleFactor = pathGroupNormalizeScaleFactor(widthScaleFactorInput);
        heightScaleFactor = widthScaleFactor;
        fillColorLimit = "#000000";
        areaMin = null;
        areaMax = null;
    }

    entries = pathGroupCollectEntries(areaMin, areaMax, fillColorLimit);

    var clusters = pathGroupBuildClusters(entries, widthScaleFactor, heightScaleFactor);
    var results = [];

    for (var i = 0; i < clusters.length; i++) {
        results.push(pathGroupApplyCluster(document, clusters[i]));
    }

    var selectionResult = pathGroupSelectCreatedGroups(document, results);

    return pathGroupSummarizeResults(results, selectionResult);
}
