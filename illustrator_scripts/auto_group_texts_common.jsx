/*
 * Shared utilities for auto-grouping nearby text objects in Illustrator.
 * This library collects text frames from the current selection or the entire
 * document, filters them by an optional regex pattern, clusters nearby texts by
 * scaled bounding-box overlap, and rebuilds each cluster as a text-only group so
 * later traversals can recover whole text regions more reliably.
 */

function autoGroupGetActiveDocument() {
    if (app.documents.length === 0) {
        throw new Error("Open a document before running the auto-grouping script.");
    }

    return app.activeDocument;
}

function autoGroupNormalizeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
}

function autoGroupBuildTextMatchRegex(patternInput) {
    if (patternInput && typeof patternInput.test === "function") {
        return patternInput;
    }

    var pattern = autoGroupNormalizeString(patternInput);
    if (!pattern) {
        pattern = "[a-zA-Z]+";
    }

    try {
        return new RegExp(pattern);
    } catch (regexError) {
        throw new Error("Invalid auto-group text regex pattern: " + regexError.message);
    }
}

function autoGroupTextMatchesRegex(frame, textMatchRegex) {
    if (!textMatchRegex) {
        return true;
    }

    var text = "";
    try {
        text = autoGroupNormalizeString(frame.contents);
    } catch (contentsError) {
        text = "";
    }

    try {
        textMatchRegex.lastIndex = 0;
    } catch (lastIndexError) {
        // Ignore lastIndex resets for regex objects that do not support it.
    }

    return textMatchRegex.test(text);
}

function autoGroupHasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function autoGroupIsTextFrame(item) {
    return item && item.typename === "TextFrame";
}

function autoGroupIsTextRange(item) {
    return item && item.typename === "TextRange";
}

function autoGroupIsInsertionPoint(item) {
    return item && item.typename === "InsertionPoint";
}

function autoGroupIsGroupItem(item) {
    return item && item.typename === "GroupItem";
}

function autoGroupArrayContains(items, item) {
    for (var i = 0; i < items.length; i++) {
        if (items[i] === item) {
            return true;
        }
    }

    return false;
}

function autoGroupClearSelection(document) {
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

function autoGroupSelectCreatedGroups(document, results) {
    var selectedGroups = [];
    var selectedCount = 0;
    var skippedCount = 0;

    for (var i = 0; i < results.length; i++) {
        if (results[i] && results[i].grouped && results[i].group) {
            selectedGroups.push(results[i].group);
        }
    }

    autoGroupClearSelection(document);

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

function autoGroupIsSelectedAncestorGroup(item, selection) {
    var current = item;
    var guard = 0;

    while (current && current.parent && current.parent !== current && guard < 50) {
        current = current.parent;
        if (autoGroupIsGroupItem(current) && autoGroupArrayContains(selection, current)) {
            return true;
        }
        guard++;
    }

    return false;
}

function autoGroupNormalizeSelection(selection) {
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

function autoGroupResolveTextFrame(item) {
    if (!item) {
        return null;
    }

    if (autoGroupIsTextFrame(item)) {
        return item;
    }

    try {
        if (item.parentTextFrames && item.parentTextFrames.length) {
            return item.parentTextFrames[0];
        }
    } catch (error) {
        // Ignore parentTextFrames lookup failures and fall back below.
    }

    try {
        if (item.story && item.story.textFrames && item.story.textFrames.length) {
            return item.story.textFrames[0];
        }
    } catch (error) {
        // Ignore story lookup failures and fall back below.
    }

    var current = item;
    var guard = 0;

    while (current && guard < 20) {
        if (autoGroupIsTextFrame(current)) {
            return current;
        }

        if (!current.parent || current.parent === current) {
            break;
        }

        current = current.parent;
        guard++;
    }

    return null;
}

function autoGroupBoundsFromArray(bounds) {
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

function autoGroupGetItemBounds(item) {
    if (!item) {
        return null;
    }

    try {
        return autoGroupBoundsFromArray(item.geometricBounds);
    } catch (geometricError) {
        try {
            return autoGroupBoundsFromArray(item.controlBounds);
        } catch (controlError) {
            return null;
        }
    }
}

function autoGroupScaleBounds(bounds, scaleFactor) {
    if (!bounds) {
        return null;
    }

    var factor = typeof scaleFactor === "number" ? scaleFactor : 1.0;
    if (factor < 0) {
        factor = 0;
    }

    var scaledWidth = bounds.width * factor;
    var scaledHeight = bounds.height * factor;

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

function autoGroupBoundsOverlap(leftBounds, rightBounds) {
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

function autoGroupGetEntryVisualPosition(entry) {
    var position = {
        top: 0,
        left: 0
    };

    if (!entry) {
        return position;
    }

    if (entry.bounds) {
        position.top = entry.bounds.top;
        position.left = entry.bounds.left;
        return position;
    }

    if (entry.frame) {
        try {
            position.top = entry.frame.top;
        } catch (topError) {
            position.top = 0;
        }

        try {
            position.left = entry.frame.left;
        } catch (leftError) {
            position.left = 0;
        }
    }

    return position;
}

function autoGroupCompareVisualOrder(leftEntry, rightEntry) {
    var leftPosition = autoGroupGetEntryVisualPosition(leftEntry);
    var rightPosition = autoGroupGetEntryVisualPosition(rightEntry);
    var tolerance = 0.5;

    if (Math.abs(leftPosition.top - rightPosition.top) > tolerance) {
        return leftPosition.top > rightPosition.top ? -1 : 1;
    }

    if (Math.abs(leftPosition.left - rightPosition.left) > tolerance) {
        return leftPosition.left < rightPosition.left ? -1 : 1;
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

function autoGroupSnapshotFrame(item) {
    var frame = autoGroupResolveTextFrame(item);
    if (!frame) {
        return null;
    }

    var bounds = autoGroupGetItemBounds(frame);
    if (!bounds) {
        return null;
    }

    return {
        frame: frame,
        parent: frame.parent,
        bounds: bounds
    };
}

function autoGroupHasEntryForFrame(entries, frame) {
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].frame === frame) {
            return true;
        }
    }

    return false;
}

function autoGroupCreateEntryFromItem(item) {
    var snapshot = autoGroupSnapshotFrame(item);
    if (!snapshot) {
        return null;
    }

    return {
        frame: snapshot.frame,
        parent: snapshot.parent,
        bounds: snapshot.bounds,
        scaledBounds: null,
        collectionIndex: 0
    };
}

function autoGroupCollectEntriesFromContainer(item, entries, visited, textMatchRegex) {
    if (!item || autoGroupArrayContains(visited, item)) {
        return;
    }

    visited.push(item);

    var entry = autoGroupCreateEntryFromItem(item);
    if (entry) {
        if (textMatchRegex && !autoGroupTextMatchesRegex(entry.frame, textMatchRegex)) {
            return;
        }

        if (!autoGroupHasEntryForFrame(entries, entry.frame)) {
            entries.push(entry);
        }
        return;
    }

    try {
        if (item.pageItems && item.pageItems.length) {
            for (var i = 0; i < item.pageItems.length; i++) {
                autoGroupCollectEntriesFromContainer(item.pageItems[i], entries, visited, textMatchRegex);
            }
        }
    } catch (pageItemError) {
        // Ignore nested page item traversal failures.
    }

    try {
        if (item.groupItems && item.groupItems.length) {
            for (var j = 0; j < item.groupItems.length; j++) {
                autoGroupCollectEntriesFromContainer(item.groupItems[j], entries, visited, textMatchRegex);
            }
        }
    } catch (groupItemError) {
        // Ignore nested group traversal failures.
    }

    try {
        if (item.textFrames && item.textFrames.length) {
            for (var k = 0; k < item.textFrames.length; k++) {
                autoGroupCollectEntriesFromContainer(item.textFrames[k], entries, visited, textMatchRegex);
            }
        }
    } catch (textFrameError) {
        // Ignore nested text frame traversal failures.
    }

    try {
        if (item.layers && item.layers.length) {
            for (var l = 0; l < item.layers.length; l++) {
                autoGroupCollectEntriesFromContainer(item.layers[l], entries, visited, textMatchRegex);
            }
        }
    } catch (layerError) {
        // Ignore nested layer traversal failures.
    }
}

function autoGroupCollectEntries(textMatchPatternInput) {
    var document = autoGroupGetActiveDocument();
    var selection = autoGroupNormalizeSelection(app.selection);
    var roots = [];
    var textMatchRegex = autoGroupBuildTextMatchRegex(textMatchPatternInput);

    if (selection && selection.length) {
        roots = selection;
    } else {
        roots = [document];
    }

    var entries = [];

    for (var i = 0; i < roots.length; i++) {
        if (selection && selection.length && !autoGroupIsGroupItem(roots[i]) && autoGroupIsSelectedAncestorGroup(roots[i], selection)) {
            continue;
        }

        autoGroupCollectEntriesFromContainer(roots[i], entries, [], textMatchRegex);
    }

    if (!entries.length) {
        throw new Error("The current scope does not contain any text objects matching the auto-group text filter.");
    }

    for (var j = 0; j < entries.length; j++) {
        entries[j].collectionIndex = j;
    }

    entries.sort(autoGroupCompareVisualOrder);
    return entries;
}

function autoGroupBuildClusters(entries, scaleFactor) {
    var total = entries.length;
    var parent = [];
    var rank = [];
    var i;

    for (i = 0; i < total; i++) {
        parent[i] = i;
        rank[i] = 0;
        entries[i].scaledBounds = autoGroupScaleBounds(entries[i].bounds, scaleFactor);
    }

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

    for (i = 0; i < total; i++) {
        for (var j = i + 1; j < total; j++) {
            if (autoGroupBoundsOverlap(entries[i].scaledBounds, entries[j].scaledBounds)) {
                union(i, j);
            }
        }
    }

    var clusterMap = {};
    var clusterOrder = [];

    for (i = 0; i < total; i++) {
        var root = find(i);
        var key = String(root);
        if (!autoGroupHasOwn(clusterMap, key)) {
            clusterMap[key] = [];
            clusterOrder.push(key);
        }
        clusterMap[key].push(entries[i]);
    }

    var clusters = [];
    for (var k = 0; k < clusterOrder.length; k++) {
        var cluster = clusterMap[clusterOrder[k]];
        cluster.sort(autoGroupCompareVisualOrder);
        clusters.push(cluster);
    }

    clusters.sort(function (leftCluster, rightCluster) {
        return autoGroupCompareVisualOrder(leftCluster[0], rightCluster[0]);
    });

    return clusters;
}

function autoGroupGetAncestorChain(item, document) {
    var chain = [];
    var current = item;
    var guard = 0;

    while (current && guard < 100) {
        chain.push(current);
        if (current === document) {
            break;
        }
        if (!current.parent || current.parent === current) {
            break;
        }
        current = current.parent;
        guard++;
    }

    if (document && !autoGroupArrayContains(chain, document)) {
        chain.push(document);
    }

    return chain;
}

function autoGroupFindCommonAncestor(entries, document) {
    if (!entries.length) {
        return document;
    }

    var firstChain = autoGroupGetAncestorChain(entries[0].parent, document);

    for (var i = 0; i < firstChain.length; i++) {
        var candidate = firstChain[i];
        var matchesAll = true;

        for (var j = 1; j < entries.length; j++) {
            var otherChain = autoGroupGetAncestorChain(entries[j].parent, document);
            if (!autoGroupArrayContains(otherChain, candidate)) {
                matchesAll = false;
                break;
            }
        }

        if (matchesAll) {
            return candidate;
        }
    }

    return document;
}

function autoGroupCanEditFrame(frame) {
    if (!frame) {
        return false;
    }

    try {
        if (frame.editable === false) {
            return false;
        }
    } catch (editableError) {
        // Ignore missing editable checks and continue.
    }

    try {
        if (frame.locked) {
            return false;
        }
    } catch (lockedError) {
        // Ignore missing locked checks and continue.
    }

    try {
        if (frame.hidden) {
            return false;
        }
    } catch (hiddenError) {
        // Ignore missing hidden checks and continue.
    }

    return true;
}

function autoGroupPromoteGroupVisibility(groupItem) {
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
    } catch (zOrderError) {
        // Ignore stacking-order failures and keep the regrouping result intact.
    }

    return promoted;
}

function autoGroupPromoteLayerVisibility(layerItem) {
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

function autoGroupFindVisibilityHostLayer(container, document) {
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

function autoGroupApplyCluster(document, cluster) {
    if (cluster.length < 1) {
        return {
            grouped: false,
            moved: 0,
            skipped: true,
            reason: "empty_cluster"
        };
    }

    for (var i = 0; i < cluster.length; i++) {
        if (!autoGroupCanEditFrame(cluster[i].frame)) {
            return {
                grouped: false,
                moved: 0,
                skipped: true,
                reason: "locked_or_hidden"
            };
        }
    }

    var targetContainer = autoGroupFindCommonAncestor(cluster, document);
    if (!targetContainer || !targetContainer.groupItems) {
        targetContainer = document;
    }

    var visibilityHost = autoGroupFindVisibilityHostLayer(targetContainer, document);
    if (!visibilityHost || !visibilityHost.groupItems) {
        visibilityHost = targetContainer;
    }

    var newGroup = null;
    try {
        newGroup = visibilityHost.groupItems.add();
    } catch (createError) {
        throw new Error("Failed to create a group for nearby text items: " + createError.message);
    }

    var movedCount = 0;
    var failedItems = [];

    for (var j = 0; j < cluster.length; j++) {
        var frame = cluster[j].frame;
        var moved = false;

        try {
            frame.move(newGroup, ElementPlacement.PLACEATEND);
            moved = true;
        } catch (moveError) {
            try {
                frame.duplicate(newGroup, ElementPlacement.PLACEATEND);
                frame.remove();
                moved = true;
            } catch (duplicateError) {
                moved = false;
            }
        }

        if (moved) {
            movedCount++;
        } else {
            failedItems.push(frame);
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

    autoGroupPromoteLayerVisibility(visibilityHost);
    autoGroupPromoteGroupVisibility(newGroup);

    return {
        grouped: true,
        moved: movedCount,
        skipped: false,
        failedItems: failedItems,
        group: newGroup
    };
}

function autoGroupSummarizeResults(results, selectionResult) {
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
        return "No nearby text items required regrouping." + (selectionResult ? " Cleared selection." : "");
    }

    var summary = "Auto-grouped " + movedItems + " text item(s) into " + groupedClusters + " group(s).";
    if (selectionResult) {
        summary += " Selected " + selectionResult.selectedCount + " group(s).";
        if (selectionResult.skippedCount > 0) {
            summary += " Skipped " + selectionResult.skippedCount + " group(s) that could not be selected.";
        }
    }

    return summary;
}

function autoGroupRunHeadless(scaleFactorInput, textMatchPatternInput) {
    var document = autoGroupGetActiveDocument();
    var entries = autoGroupCollectEntries(textMatchPatternInput);
    var scaleFactor = typeof scaleFactorInput === "number" ? scaleFactorInput : 1.0;

    if (scaleFactor <= 0) {
        scaleFactor = 1.0;
    }

    var clusters = autoGroupBuildClusters(entries, scaleFactor);
    var results = [];

    for (var i = 0; i < clusters.length; i++) {
        results.push(autoGroupApplyCluster(document, clusters[i]));
    }

    var selectionResult = autoGroupSelectCreatedGroups(document, results);

    return autoGroupSummarizeResults(results, selectionResult);
}
