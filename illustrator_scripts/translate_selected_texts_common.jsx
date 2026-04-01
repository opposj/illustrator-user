/*
 * Shared utilities for translating selected English text in Illustrator.
 * This library collects text selections, parses translation tables, applies
 * replacements in place, preserves styling attributes, and restores text frame
 * position so the translated content stays centered where possible.
 */

function translateSelectedTextsGetActiveDocument() {
    if (app.documents.length === 0) {
        throw new Error("Open a document before running the translation script.");
    }

    return app.activeDocument;
}

function translateSelectedTextsNormalizeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value);
}

function translateSelectedTextsNormalizeGroupReplaceMode(value) {
    var mode = translateSelectedTextsNormalizeString(value).toLowerCase();

    if (!mode) {
        return "whole";
    }

    if (mode === "whole" || mode === "group" || mode === "together" || mode === "as-a-whole" || mode === "all") {
        return "whole";
    }

    if (mode === "individual" || mode === "one-by-one" || mode === "onebyone" || mode === "separate" || mode === "parts") {
        return "individual";
    }

    return "whole";
}

function translateSelectedTextsIsTextFrame(item) {
    return item && item.typename === "TextFrame";
}

function translateSelectedTextsIsTextRange(item) {
    return item && item.typename === "TextRange";
}

function translateSelectedTextsIsInsertionPoint(item) {
    return item && item.typename === "InsertionPoint";
}

function translateSelectedTextsIsGroupItem(item) {
    return item && item.typename === "GroupItem";
}

function translateSelectedTextsHasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function translateSelectedTextsArrayContains(items, item) {
    for (var i = 0; i < items.length; i++) {
        if (items[i] === item) {
            return true;
        }
    }

    return false;
}

function translateSelectedTextsIsSelectedAncestorGroup(item, selection) {
    var current = item;
    var guard = 0;

    while (current && current.parent && current.parent !== current && guard < 50) {
        current = current.parent;
        if (translateSelectedTextsIsGroupItem(current) && translateSelectedTextsArrayContains(selection, current)) {
            return true;
        }
        guard++;
    }

    return false;
}

function translateSelectedTextsSnapshotGroupMetrics(groupItem) {
    if (!groupItem) {
        return null;
    }

    return {
        left: groupItem.left,
        top: groupItem.top,
        width: groupItem.width,
        height: groupItem.height
    };
}

function translateSelectedTextsGetEntryVisualPosition(entry) {
    var position = {
        top: 0,
        left: 0
    };

    if (!entry || !entry.frame) {
        if (entry && entry.groupSnapshot) {
            try {
                position.top = entry.groupSnapshot.top;
            } catch (groupTopError) {
                position.top = 0;
            }

            try {
                position.left = entry.groupSnapshot.left;
            } catch (groupLeftError) {
                position.left = 0;
            }

            return position;
        }

        if (entry && entry.groupItem) {
            try {
                position.top = entry.groupItem.top;
            } catch (groupItemTopError) {
                position.top = 0;
            }

            try {
                position.left = entry.groupItem.left;
            } catch (groupItemLeftError) {
                position.left = 0;
            }

            return position;
        }

        return position;
    }

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

    return position;
}

function translateSelectedTextsCompareVisualOrder(leftEntry, rightEntry) {
    var leftPosition = translateSelectedTextsGetEntryVisualPosition(leftEntry);
    var rightPosition = translateSelectedTextsGetEntryVisualPosition(rightEntry);
    var tolerance = 0.5;

    if (Math.abs(leftPosition.top - rightPosition.top) > tolerance) {
        return leftPosition.top > rightPosition.top ? -1 : 1;
    }

    if (Math.abs(leftPosition.left - rightPosition.left) > tolerance) {
        return leftPosition.left < rightPosition.left ? -1 : 1;
    }

    var leftIndex = typeof leftEntry.groupSortIndex === "number" ? leftEntry.groupSortIndex : 0;
    if (leftIndex === 0 && typeof leftEntry.displaySortIndex === "number") {
        leftIndex = leftEntry.displaySortIndex;
    }

    var rightIndex = typeof rightEntry.groupSortIndex === "number" ? rightEntry.groupSortIndex : 0;
    if (rightIndex === 0 && typeof rightEntry.displaySortIndex === "number") {
        rightIndex = rightEntry.displaySortIndex;
    }

    if (leftIndex < rightIndex) {
        return -1;
    }

    if (leftIndex > rightIndex) {
        return 1;
    }

    return 0;
}

function translateSelectedTextsSortEntriesForDisplay(entries) {
    for (var i = 0; i < entries.length; i++) {
        entries[i].displaySortIndex = i;
    }

    entries.sort(translateSelectedTextsCompareVisualOrder);

    for (var j = 0; j < entries.length; j++) {
        entries[j].translationKey = "entry-" + j;
    }

    return entries;
}

function translateSelectedTextsIsArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
}

function translateSelectedTextsEscapeJsonString(value) {
    var text = translateSelectedTextsNormalizeString(value);
    var result = "";

    for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);

        if (ch === "\\") {
            result += "\\\\";
        } else if (ch === '"') {
            result += "\\\"";
        } else if (ch === "\b") {
            result += "\\b";
        } else if (ch === "\f") {
            result += "\\f";
        } else if (ch === "\n") {
            result += "\\n";
        } else if (ch === "\r") {
            result += "\\r";
        } else if (ch === "\t") {
            result += "\\t";
        } else {
            var code = ch.charCodeAt(0);
            if (code < 0x20) {
                var hex = code.toString(16).toUpperCase();
                while (hex.length < 4) {
                    hex = "0" + hex;
                }
                result += "\\u" + hex;
            } else {
                result += ch;
            }
        }
    }

    return result;
}

function translateSelectedTextsSerializeJson(value) {
    if (value === null || value === undefined) {
        return "null";
    }

    if (typeof value === "string") {
        return '"' + translateSelectedTextsEscapeJsonString(value) + '"';
    }

    if (typeof value === "number") {
        return isFinite(value) ? String(value) : "null";
    }

    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }

    if (translateSelectedTextsIsArray(value)) {
        var arrayParts = [];
        for (var i = 0; i < value.length; i++) {
            arrayParts.push(translateSelectedTextsSerializeJson(value[i]));
        }
        return "[" + arrayParts.join(",") + "]";
    }

    if (typeof value === "object") {
        var keys = [];
        for (var key in value) {
            if (translateSelectedTextsHasOwn(value, key)) {
                keys.push(key);
            }
        }
        keys.sort();

        var objectParts = [];
        for (var j = 0; j < keys.length; j++) {
            objectParts.push(
                '"' + translateSelectedTextsEscapeJsonString(keys[j]) + '":' + translateSelectedTextsSerializeJson(value[keys[j]])
            );
        }
        return "{" + objectParts.join(",") + "}";
    }

    return "null";
}

function translateSelectedTextsWriteTextFile(filePath, content) {
    var file = new File(filePath);

    file.encoding = "UTF-8";
    if (!file.open("w")) {
        throw new Error("Failed to open output file: " + filePath);
    }

    try {
        file.write(translateSelectedTextsNormalizeString(content));
    } finally {
        file.close();
    }
}

function translateSelectedTextsBuildJobEntry(entry, index) {
    var jobEntry = {
        displayOrder: index,
        isGroupEntry: !!(entry && entry.isGroupEntry),
        originalText: entry && entry.originalText ? entry.originalText : "",
        translationKey: translateSelectedTextsGetEntryTranslationKey(entry)
    };

    if (entry && typeof entry.lineCount === "number") {
        jobEntry.lineCount = entry.lineCount;
    }

    if (entry && entry.isGroupEntry && entry.parts && entry.parts.length) {
        jobEntry.parts = [];
        for (var i = 0; i < entry.parts.length; i++) {
            jobEntry.parts.push({
                originalText: entry.parts[i].originalText,
                lineCount: entry.parts[i].lineCount,
                partOrder: i
            });
        }
    }

    return jobEntry;
}

function translateSelectedTextsBuildTranslationJobPayload(replaceMode) {
    var normalizedReplaceMode = translateSelectedTextsNormalizeGroupReplaceMode(replaceMode);
    var entries = translateSelectedTextsCollectEntries(normalizedReplaceMode);
    var documentName = "";

    try {
        documentName = translateSelectedTextsGetActiveDocument().name;
    } catch (documentNameError) {
        documentName = "";
    }

    translateSelectedTextsSortEntriesForDisplay(entries);

    var jobEntries = [];
    var groupedEntryCount = 0;

    for (var i = 0; i < entries.length; i++) {
        if (entries[i] && entries[i].isGroupEntry) {
            groupedEntryCount++;
        }
        jobEntries.push(translateSelectedTextsBuildJobEntry(entries[i], i));
    }

    return {
        entryCount: entries.length,
        entries: jobEntries,
        documentName: documentName,
        groupedEntryCount: groupedEntryCount,
        replaceMode: normalizedReplaceMode,
        schema: "translate_selected_texts_job",
        version: 1
    };
}

function translateSelectedTextsSerializeJobPayload(replaceMode) {
    return translateSelectedTextsSerializeJson(translateSelectedTextsBuildTranslationJobPayload(replaceMode));
}

function translateSelectedTextsCreateTextPartsFromContainer(item, parts, visited) {
    if (!item || translateSelectedTextsArrayContains(visited, item)) {
        return;
    }

    visited.push(item);

    var entry = translateSelectedTextsCreateTextEntryFromItem(item);
    if (entry) {
        parts.push(entry);
        return;
    }

    try {
        if (item.pageItems && item.pageItems.length) {
            for (var i = 0; i < item.pageItems.length; i++) {
                translateSelectedTextsCreateTextPartsFromContainer(item.pageItems[i], parts, visited);
            }
        }
    } catch (error) {
        // Ignore nested page item traversal failures.
    }

    try {
        if (item.groupItems && item.groupItems.length) {
            for (var j = 0; j < item.groupItems.length; j++) {
                translateSelectedTextsCreateTextPartsFromContainer(item.groupItems[j], parts, visited);
            }
        }
    } catch (error) {
        // Ignore nested group traversal failures.
    }

    try {
        if (item.textFrames && item.textFrames.length) {
            for (var k = 0; k < item.textFrames.length; k++) {
                translateSelectedTextsCreateTextPartsFromContainer(item.textFrames[k], parts, visited);
            }
        }
    } catch (error) {
        // Ignore nested text frame traversal failures.
    }
}

function translateSelectedTextsDeleteEntry(entry) {
    if (!entry) {
        return;
    }

    if (entry.isGroupEntry) {
        for (var i = entry.parts.length - 1; i >= 0; i--) {
            try {
                entry.parts[i].frame.remove();
            } catch (removeError) {
                // Ignore cleanup failures while deleting grouped text entries.
            }
        }

        try {
            entry.groupItem.remove();
        } catch (groupRemoveError) {
            // Ignore cleanup failures after deleting grouped text entries.
        }

        return;
    }

    try {
        if (entry.isWholeFrame && entry.frame) {
            entry.frame.remove();
            return;
        }
    } catch (frameRemoveError) {
        // Fall back to clearing the text range below.
    }

    try {
        entry.range.contents = "";
    } catch (rangeClearError) {
        // Ignore cleanup failures for partial text entries.
    }
}

function translateSelectedTextsBuildGroupReplacementModeDialog(defaultMode) {
    var normalizedDefaultMode = translateSelectedTextsNormalizeGroupReplaceMode(defaultMode);
    var win = new Window("dialog", "Group Replacement Mode");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 16;

    var intro = win.add(
        "statictext",
        undefined,
        "Choose how grouped text should be replaced before entering translations.",
        { multiline: true }
    );
    intro.alignment = ["fill", "top"];

    var modePanel = win.add("panel", undefined, "Replacement mode");
    modePanel.orientation = "column";
    modePanel.alignChildren = ["left", "top"];
    modePanel.margins = 12;

    var wholeRadio = modePanel.add("radiobutton", undefined, "Replace grouped text as a whole");
    var individualRadio = modePanel.add("radiobutton", undefined, "Replace grouped text one by one");

    wholeRadio.value = normalizedDefaultMode !== "individual";
    individualRadio.value = normalizedDefaultMode === "individual";

    var buttonGroup = win.add("group");
    buttonGroup.alignment = "right";

    var accepted = false;
    var result = null;

    var okButton = buttonGroup.add("button", undefined, "Continue", { name: "ok" });
    var cancelButton = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

    okButton.onClick = function () {
        result = individualRadio.value ? "individual" : "whole";
        accepted = true;
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

function translateSelectedTextsNormalizeLineBreaks(value) {
    return translateSelectedTextsNormalizeString(value).replace(/\r\n|\r|\n/g, "\r");
}

function translateSelectedTextsSplitLines(value) {
    var normalized = translateSelectedTextsNormalizeLineBreaks(value);

    if (normalized.length === 0) {
        return [""];
    }

    return normalized.split("\r");
}

function translateSelectedTextsCountLines(value) {
    return translateSelectedTextsSplitLines(value).length;
}

function translateSelectedTextsGetCharacterAttributeNames() {
    return [
        "akiLeft",
        "akiRight",
        "alignment",
        "alternateGlyphs",
        "autoLeading",
        "baselineDirection",
        "baselinePosition",
        "baselineShift",
        "capitalization",
        "connectionForms",
        "contextualLigature",
        "discretionaryLigature",
        "figureStyle",
        "fillColor",
        "fractions",
        "horizontalScale",
        "italics",
        "kerningMethod",
        "language",
        "leading",
        "ligature",
        "noBreak",
        "openTypePosition",
        "ordinals",
        "ornaments",
        "overprintFill",
        "overprintStroke",
        "proportionalMetrics",
        "rotation",
        "size",
        "strikeThrough",
        "strokeColor",
        "strokeWeight",
        "stylisticAlternates",
        "swash",
        "tateChuYokoHorizontal",
        "tateChuYokoVertical",
        "textFont",
        "titling",
        "tracking",
        "Tsume",
        "underline",
        "verticalScale",
        "waiChuEnabled",
        "wariChuCharactersAfterBreak",
        "wariChuCharactersBeforeBreak",
        "wariChuJustification",
        "wariChuLineGap",
        "wariChuLines",
        "wariChuScale"
    ];
}

function translateSelectedTextsGetParagraphAttributeNames() {
    return [
        "autoLeadingAmount",
        "bunriKinshi",
        "burasagariType",
        "desiredGlyphScaling",
        "desiredLetterSpacing",
        "desiredWordSpacing",
        "everyLineComposer",
        "firstLineIndent",
        "hyphenateCapitalizedWords",
        "hyphenation",
        "hyphenationPreference",
        "hyphenationZone",
        "justification",
        "kinsoku",
        "kinsokuOrder",
        "kurikaeshiMojiShori",
        "leadingType",
        "leftIndent",
        "maximumConsecutiveHyphens",
        "maximumGlyphScaling",
        "maximumLetterSpacing",
        "maximumWordSpacing",
        "minimumAfterHyphen",
        "minimumBeforeHyphen",
        "minimumGlyphScaling",
        "minimumHyphenatedWordSize",
        "minimumLetterSpacing",
        "minimumWordSpacing",
        "mojikumi",
        "rightIndent",
        "romanHanging",
        "singleWordJustification",
        "spaceAfter",
        "spaceBefore",
        "tabStops"
    ];
}

function translateSelectedTextsSnapshotProperties(source, preferredKeys) {
    var snapshot = {};

    if (!source) {
        return snapshot;
    }

    for (var key in source) {
        if (key === "parent" || key === "typename") {
            continue;
        }

        try {
            var value = source[key];
            if (typeof value !== "function") {
                snapshot[key] = value;
            }
        } catch (error) {
            // Ignore properties that are not readable in the current context.
        }
    }

    if (preferredKeys && preferredKeys.length) {
        for (var i = 0; i < preferredKeys.length; i++) {
            var preferredKey = preferredKeys[i];
            if (translateSelectedTextsHasOwn(snapshot, preferredKey)) {
                continue;
            }

            try {
                var preferredValue = source[preferredKey];
                if (typeof preferredValue !== "function") {
                    snapshot[preferredKey] = preferredValue;
                }
            } catch (preferredError) {
                // Ignore properties that are not readable in the current context.
            }
        }
    }

    return snapshot;
}

function translateSelectedTextsSnapshotCharacterAttributes(characterAttributes) {
    return translateSelectedTextsSnapshotProperties(characterAttributes, translateSelectedTextsGetCharacterAttributeNames());
}

function translateSelectedTextsSnapshotParagraphAttributeProperties(paragraphAttributes) {
    return translateSelectedTextsSnapshotProperties(paragraphAttributes, translateSelectedTextsGetParagraphAttributeNames());
}

function translateSelectedTextsRestoreProperties(target, snapshot) {
    if (!target || !snapshot) {
        return;
    }

    for (var key in snapshot) {
        try {
            target[key] = snapshot[key];
        } catch (error) {
            // Ignore properties that cannot be restored safely.
        }
    }
}

function translateSelectedTextsSnapshotStrokeAttributes(characterAttributes) {
    var snapshot = {
        hasStrokeWeight: false,
        hasStrokeColor: false,
        hasOverprintStroke: false,
        strokeWeight: 0,
        strokeColor: null,
        overprintStroke: false
    };

    if (!characterAttributes) {
        return snapshot;
    }

    try {
        snapshot.strokeWeight = characterAttributes.strokeWeight;
        snapshot.hasStrokeWeight = true;
    } catch (error) {
        // Ignore missing strokeWeight values.
    }

    try {
        snapshot.strokeColor = characterAttributes.strokeColor;
        snapshot.hasStrokeColor = true;
    } catch (error) {
        // Ignore missing strokeColor values.
    }

    try {
        snapshot.overprintStroke = characterAttributes.overprintStroke;
        snapshot.hasOverprintStroke = true;
    } catch (error) {
        // Ignore missing overprintStroke values.
    }

    return snapshot;
}

function translateSelectedTextsRestoreStrokeAttributes(characterAttributes, snapshot) {
    if (!characterAttributes || !snapshot) {
        return;
    }

    try {
        characterAttributes.strokeWeight = snapshot.hasStrokeWeight ? snapshot.strokeWeight : 0;
    } catch (error) {
        // Ignore strokeWeight restoration failures.
    }

    try {
        if (snapshot.hasStrokeColor) {
            characterAttributes.strokeColor = snapshot.strokeColor;
        }
    } catch (error) {
        // Ignore strokeColor restoration failures.
    }

    try {
        if (snapshot.hasOverprintStroke) {
            characterAttributes.overprintStroke = snapshot.overprintStroke;
        }
    } catch (error) {
        // Ignore overprintStroke restoration failures.
    }
}

function translateSelectedTextsSnapshotParagraphAttributes(textRange) {
    var snapshots = [];

    try {
        var paragraphs = textRange.paragraphs;
        for (var i = 0; i < paragraphs.length; i++) {
            snapshots.push(translateSelectedTextsSnapshotParagraphAttributeProperties(paragraphs[i].paragraphAttributes));
        }
    } catch (error) {
        // Ignore paragraph snapshot failures and fall back to range-level attributes.
    }

    return snapshots;
}

function translateSelectedTextsRestoreParagraphAttributes(textRange, snapshots) {
    if (!snapshots || !snapshots.length) {
        return;
    }

    try {
        var paragraphs = textRange.paragraphs;
        var limit = paragraphs.length < snapshots.length ? paragraphs.length : snapshots.length;

        for (var i = 0; i < limit; i++) {
            translateSelectedTextsRestoreProperties(paragraphs[i].paragraphAttributes, snapshots[i]);
        }
    } catch (error) {
        // Ignore paragraph restoration failures.
    }
}

function translateSelectedTextsSnapshotFrameMetrics(frame) {
    return {
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height
    };
}

function translateSelectedTextsRecenterFrame(frame, snapshot) {
    if (!frame || !snapshot) {
        return;
    }

    try {
        var originalCenterX = snapshot.left + (snapshot.width / 2);
        var originalCenterY = snapshot.top - (snapshot.height / 2);
        var currentCenterX = frame.left + (frame.width / 2);
        var currentCenterY = frame.top - (frame.height / 2);
        var deltaX = originalCenterX - currentCenterX;
        var deltaY = originalCenterY - currentCenterY;

        if (deltaX !== 0 || deltaY !== 0) {
            frame.translate(deltaX, deltaY);
        }
    } catch (error) {
        // Ignore translation failures; the text replacement already happened.
    }
}

function translateSelectedTextsHasEntryForFrame(entries, frame) {
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].frame === frame) {
            return true;
        }
    }

    return false;
}

function translateSelectedTextsCollectLeafEntriesFromContainer(item, entries, visited) {
    if (!item || translateSelectedTextsArrayContains(visited, item)) {
        return;
    }

    visited.push(item);

    if (translateSelectedTextsIsGroupItem(item)) {
        try {
            if (item.pageItems && item.pageItems.length) {
                for (var i = 0; i < item.pageItems.length; i++) {
                    translateSelectedTextsCollectLeafEntriesFromContainer(item.pageItems[i], entries, visited);
                }
            }
        } catch (error) {
            // Ignore nested page item traversal failures.
        }

        try {
            if (item.groupItems && item.groupItems.length) {
                for (var j = 0; j < item.groupItems.length; j++) {
                    translateSelectedTextsCollectLeafEntriesFromContainer(item.groupItems[j], entries, visited);
                }
            }
        } catch (error) {
            // Ignore nested group traversal failures.
        }

        try {
            if (item.textFrames && item.textFrames.length) {
                for (var k = 0; k < item.textFrames.length; k++) {
                    translateSelectedTextsCollectLeafEntriesFromContainer(item.textFrames[k], entries, visited);
                }
            }
        } catch (error) {
            // Ignore nested text frame traversal failures.
        }

        return;
    }

    var entry = translateSelectedTextsCreateTextEntryFromItem(item);
    if (entry) {
        if (!translateSelectedTextsHasEntryForRange(entries, entry.range)) {
            entries.push(entry);
        }
        return;
    }

    try {
        if (item.pageItems && item.pageItems.length) {
            for (var i = 0; i < item.pageItems.length; i++) {
                translateSelectedTextsCollectLeafEntriesFromContainer(item.pageItems[i], entries, visited);
            }
        }
    } catch (error) {
        // Ignore nested page item traversal failures.
    }

    try {
        if (item.groupItems && item.groupItems.length) {
            for (var j = 0; j < item.groupItems.length; j++) {
                translateSelectedTextsCollectLeafEntriesFromContainer(item.groupItems[j], entries, visited);
            }
        }
    } catch (error) {
        // Ignore nested group traversal failures.
    }

    try {
        if (item.textFrames && item.textFrames.length) {
            for (var k = 0; k < item.textFrames.length; k++) {
                translateSelectedTextsCollectLeafEntriesFromContainer(item.textFrames[k], entries, visited);
            }
        }
    } catch (error) {
        // Ignore nested text frame traversal failures.
    }
}

function translateSelectedTextsHasEntryForRange(entries, range) {
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].range === range) {
            return true;
        }
    }

    return false;
}

function translateSelectedTextsResolveTextFrame(item) {
    if (!item) {
        return null;
    }

    if (translateSelectedTextsIsTextFrame(item)) {
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
        if (translateSelectedTextsIsTextFrame(current)) {
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

function translateSelectedTextsCreateTextEntryFromRange(textRange) {
    var frame = translateSelectedTextsResolveTextFrame(textRange);

    if (!frame) {
        return null;
    }

    var originalText = translateSelectedTextsNormalizeString(textRange.contents);
    var frameText = translateSelectedTextsNormalizeString(frame.textRange.contents);
    var rangeLength = 0;
    var frameLength = 0;

    try {
        rangeLength = textRange.length;
    } catch (error) {
        rangeLength = 0;
    }

    try {
        frameLength = frame.textRange.length;
    } catch (error) {
        frameLength = 0;
    }

    return {
        frame: frame,
        range: textRange,
        originalText: originalText,
        lineCount: translateSelectedTextsCountLines(originalText),
        isWholeFrame: rangeLength > 0 && rangeLength === frameLength && originalText === frameText,
        characterSnapshot: translateSelectedTextsSnapshotCharacterAttributes(textRange.characterAttributes),
        strokeSnapshot: translateSelectedTextsSnapshotStrokeAttributes(textRange.characterAttributes),
        paragraphSnapshots: translateSelectedTextsSnapshotParagraphAttributes(textRange),
        frameSnapshot: translateSelectedTextsSnapshotFrameMetrics(frame)
    };
}

function translateSelectedTextsCreateTextEntryFromItem(item) {
    if (translateSelectedTextsIsTextFrame(item)) {
        return translateSelectedTextsCreateTextEntryFromRange(item.textRange);
    }

    if (translateSelectedTextsIsTextRange(item)) {
        return translateSelectedTextsCreateTextEntryFromRange(item);
    }

    if (translateSelectedTextsIsInsertionPoint(item)) {
        try {
            if (item.parent && item.parent.textRange) {
                return translateSelectedTextsCreateTextEntryFromRange(item.parent.textRange);
            }
        } catch (error) {
            // Ignore insertion point conversion failures.
        }
    }

    return null;
}

function translateSelectedTextsCreateGroupedEntryFromItem(groupItem) {
    var parts = [];
    translateSelectedTextsCreateTextPartsFromContainer(groupItem, parts, []);

    if (!parts.length) {
        return null;
    }

    for (var i = 0; i < parts.length; i++) {
        parts[i].groupSortIndex = i;
    }

    parts.sort(translateSelectedTextsCompareVisualOrder);

    var originalText = "";
    for (var i = 0; i < parts.length; i++) {
        originalText += translateSelectedTextsNormalizeString(parts[i].originalText);
    }

    return {
        isGroupEntry: true,
        groupItem: groupItem,
        parts: parts,
        originalText: originalText,
        groupSnapshot: translateSelectedTextsSnapshotGroupMetrics(groupItem)
    };
}

function translateSelectedTextsCreateEntryFromItem(item) {
    if (translateSelectedTextsIsGroupItem(item)) {
        return translateSelectedTextsCreateGroupedEntryFromItem(item);
    }

    return translateSelectedTextsCreateTextEntryFromItem(item);
}

function translateSelectedTextsCollectEntriesFromItem(item, entries, replaceMode) {
    var normalizedReplaceMode = translateSelectedTextsNormalizeGroupReplaceMode(replaceMode);

    if (normalizedReplaceMode === "individual") {
        translateSelectedTextsCollectLeafEntriesFromContainer(item, entries, []);
        return;
    }

    var entry = translateSelectedTextsCreateEntryFromItem(item);

    if (entry) {
        if (entry.isGroupEntry) {
            entries.push(entry);
            return;
        }

        if (!translateSelectedTextsHasEntryForRange(entries, entry.range)) {
            entries.push(entry);
        }
        return;
    }

    try {
        if (item && item.textFrames && item.textFrames.length) {
            for (var i = 0; i < item.textFrames.length; i++) {
                translateSelectedTextsCollectEntriesFromItem(item.textFrames[i], entries);
            }
        }
    } catch (error) {
        // Ignore nested text frame traversal failures.
    }

    try {
        if (item && item.pageItems && item.pageItems.length) {
            for (var j = 0; j < item.pageItems.length; j++) {
                translateSelectedTextsCollectEntriesFromItem(item.pageItems[j], entries);
            }
        }
    } catch (error) {
        // Ignore nested page item traversal failures.
    }
}

function translateSelectedTextsNormalizeSelection(selection) {
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

function translateSelectedTextsCollectEntries(replaceMode) {
    translateSelectedTextsGetActiveDocument();
    var selection = translateSelectedTextsNormalizeSelection(app.selection);
    var normalizedReplaceMode = translateSelectedTextsNormalizeGroupReplaceMode(replaceMode);

    if (!selection || selection.length === 0) {
        throw new Error("Select one or more text objects before running the translation script.");
    }

    var entries = [];

    for (var i = 0; i < selection.length; i++) {
        if (!translateSelectedTextsIsGroupItem(selection[i]) && translateSelectedTextsIsSelectedAncestorGroup(selection[i], selection)) {
            continue;
        }

        translateSelectedTextsCollectEntriesFromItem(selection[i], entries, normalizedReplaceMode);
    }

    if (!entries.length) {
        throw new Error("The current selection does not contain any text objects.");
    }

    return entries;
}

function translateSelectedTextsParseTranslationTable(input) {
    if (input === null || input === undefined || input === "") {
        throw new Error("A translation table is required.");
    }

    var table = input;

    if (typeof input === "string") {
        if (typeof JSON !== "undefined" && JSON.parse) {
            try {
                table = JSON.parse(input);
            } catch (jsonError) {
                table = eval("(" + input + ")");
            }
        } else {
            table = eval("(" + input + ")");
        }
    }

    if (typeof table !== "object") {
        throw new Error("The translation table must be a JSON object.");
    }

    return table;
}

function translateSelectedTextsGetTranslation(table, originalText) {
    var lookup = translateSelectedTextsLookupTranslation(table, originalText);

    if (lookup.found && lookup.value.length > 0) {
        return lookup.value;
    }

    return null;
}

function translateSelectedTextsLookupTranslation(table, originalText) {
    if (!table) {
        return {
            found: false,
            value: ""
        };
    }

    if (!translateSelectedTextsHasOwn(table, originalText)) {
        return {
            found: false,
            value: ""
        };
    }

    return {
        found: true,
        value: translateSelectedTextsNormalizeString(table[originalText])
    };
}

function translateSelectedTextsGetEntryTranslationKey(entry) {
    if (entry && entry.translationKey) {
        return entry.translationKey;
    }

    return entry && entry.originalText ? entry.originalText : "";
}

function translateSelectedTextsNormalizeEmptyEntryAction(value) {
    var action = translateSelectedTextsNormalizeString(value).toLowerCase();

    if (action === "delete") {
        return "delete";
    }

    if (action === "leave") {
        return "leave";
    }

    return "leave";
}

function translateSelectedTextsBuildEmptyEntryActionDialog(emptyCount, defaultAction) {
    var normalizedDefaultAction = translateSelectedTextsNormalizeEmptyEntryAction(defaultAction);
    var win = new Window("dialog", "Empty Translation Entries");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 16;

    var intro = win.add(
        "statictext",
        undefined,
        "There are " + emptyCount + " empty translation field(s). Choose what to do with them.\nCancel returns to the translation dialog so you can fill them in.",
        { multiline: true }
    );
    intro.alignment = ["fill", "top"];

    var choicePanel = win.add("panel", undefined, "Empty entries");
    choicePanel.orientation = "column";
    choicePanel.alignChildren = ["left", "top"];
    choicePanel.margins = 12;

    var leaveRadio = choicePanel.add("radiobutton", undefined, "Leave the empty entries unchanged");
    var deleteRadio = choicePanel.add("radiobutton", undefined, "Delete the texts corresponding to empty entries");

    leaveRadio.value = normalizedDefaultAction !== "delete";
    deleteRadio.value = normalizedDefaultAction === "delete";

    var buttonGroup = win.add("group");
    buttonGroup.alignment = "right";

    var accepted = false;
    var result = null;

    var okButton = buttonGroup.add("button", undefined, "Continue", { name: "ok" });
    var cancelButton = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

    okButton.onClick = function () {
        result = deleteRadio.value ? "delete" : "leave";
        accepted = true;
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

function translateSelectedTextsApplyTranslationToEntry(entry, translatedText) {
    if (entry.isGroupEntry) {
        translateSelectedTextsApplyTranslationToGroupedEntry(entry, translatedText);
        return;
    }

    entry.range.contents = translatedText;
    translateSelectedTextsRestoreProperties(entry.range.characterAttributes, entry.characterSnapshot);
    translateSelectedTextsRestoreStrokeAttributes(entry.range.characterAttributes, entry.strokeSnapshot);
    translateSelectedTextsRestoreParagraphAttributes(entry.range, entry.paragraphSnapshots);

    if (entry.isWholeFrame) {
        translateSelectedTextsRecenterFrame(entry.frame, entry.frameSnapshot);
    }
}
function translateSelectedTextsApplyTranslationToGroupedEntry(entry, translatedText) {
    if (!entry.parts.length) {
        return;
    }

    var firstPart = entry.parts[0];
    var groupBounds = entry.groupSnapshot;
    var sourceFrame = firstPart.frame;
    var newFrame = null;

    try {
        newFrame = sourceFrame.duplicate(entry.groupItem, ElementPlacement.PLACEATEND);
    } catch (error) {
        throw new Error("Failed to create the replacement text item for the grouped selection: " + error.message);
    }

    try {
        newFrame.contents = translatedText;
        translateSelectedTextsRestoreProperties(newFrame.characterAttributes, firstPart.characterSnapshot);
        translateSelectedTextsRestoreStrokeAttributes(newFrame.characterAttributes, firstPart.strokeSnapshot);
        translateSelectedTextsRestoreParagraphAttributes(newFrame, firstPart.paragraphSnapshots);
        try {
            newFrame.textRange.paragraphAttributes.justification = Justification.CENTER;
        } catch (justifyError) {
            try {
                var newParagraphs = newFrame.paragraphs;
                for (var j = 0; j < newParagraphs.length; j++) {
                    newParagraphs[j].paragraphAttributes.justification = Justification.CENTER;
                }
            } catch (paragraphJustifyError) {
                // Ignore justification failures; the replacement still succeeded.
            }
        }
    } catch (error) {
        try {
            newFrame.remove();
        } catch (cleanupError) {
            // Ignore cleanup failures after a grouped replacement error.
        }
        throw new Error("Failed to apply grouped translation: " + error.message);
    }

    if (groupBounds) {
        try {
            var originalCenterX = groupBounds.left + (groupBounds.width / 2);
            var originalCenterY = groupBounds.top - (groupBounds.height / 2);
            var currentCenterX = newFrame.left + (newFrame.width / 2);
            var currentCenterY = newFrame.top - (newFrame.height / 2);
            var deltaX = originalCenterX - currentCenterX;
            var deltaY = originalCenterY - currentCenterY;

            if (deltaX !== 0 || deltaY !== 0) {
                newFrame.translate(deltaX, deltaY);
            }
        } catch (error) {
            // Ignore recenter failures; the text replacement already happened.
        }
    }

    for (var i = entry.parts.length - 1; i >= 0; i--) {
        try {
            entry.parts[i].frame.remove();
        } catch (error) {
            // Ignore cleanup failures for grouped text items.
        }
    }
}

function translateSelectedTextsTranslateEntries(entries, translationTable, emptyEntryAction) {
    var missing = [];
    var translatedCount = 0;
    var normalizedEmptyEntryAction = translateSelectedTextsNormalizeEmptyEntryAction(emptyEntryAction);
    var allowEmptyTranslation = arguments.length > 2;

    if (!allowEmptyTranslation) {
        for (var i = 0; i < entries.length; i++) {
            var entryKey = translateSelectedTextsGetEntryTranslationKey(entries[i]);
            var translationLookup = translateSelectedTextsLookupTranslation(translationTable, entryKey);
            if (!translationLookup.found && entryKey !== entries[i].originalText) {
                translationLookup = translateSelectedTextsLookupTranslation(translationTable, entries[i].originalText);
            }

            if (!translationLookup.found || translationLookup.value.length === 0) {
                missing.push(entries[i].originalText);
            }
        }

        if (missing.length) {
            var message = "Missing translations for the following selected text(s):\n";
            for (var j = 0; j < missing.length; j++) {
                message += "- " + missing[j] + "\n";
            }
            throw new Error(message);
        }
    }

    for (var k = 0; k < entries.length; k++) {
        var entryKey = translateSelectedTextsGetEntryTranslationKey(entries[k]);
        var translationLookup = translateSelectedTextsLookupTranslation(translationTable, entryKey);

        if (!translationLookup.found && entryKey !== entries[k].originalText) {
            translationLookup = translateSelectedTextsLookupTranslation(translationTable, entries[k].originalText);
        }

        if (translationLookup.value.length === 0) {
            if (normalizedEmptyEntryAction === "leave") {
                continue;
            }

            if (normalizedEmptyEntryAction === "delete") {
                translateSelectedTextsDeleteEntry(entries[k]);
                translatedCount++;
            }
            continue;
        }

        translateSelectedTextsApplyTranslationToEntry(entries[k], translationLookup.value);
        translatedCount++;
    }

    return translatedCount;
}

function translateSelectedTextsLabelText(text) {
    var value = translateSelectedTextsNormalizeString(text);
    value = value.replace(/\r\n|\r|\n| /g, "");
    return value;
}

function translateSelectedTextsEstimateDialogRowHeight(entry) {
    if (entry && entry.isGroupEntry) {
        return 104;
    }

    return 60;
}

function translateSelectedTextsBuildDialogPageRanges(entries) {
    var ranges = [];
    var start = 0;
    var maxEstimatedHeight = 420;
    var maxEntriesPerPage = 8;

    while (start < entries.length) {
        var end = start;
        var estimatedHeight = 0;

        while (end < entries.length && (end - start) < maxEntriesPerPage) {
            var rowHeight = translateSelectedTextsEstimateDialogRowHeight(entries[end]);

            if (end > start && estimatedHeight + rowHeight > maxEstimatedHeight) {
                break;
            }

            estimatedHeight += rowHeight;
            end++;

            if (estimatedHeight >= maxEstimatedHeight) {
                break;
            }
        }

        if (end === start) {
            end = start + 1;
        }

        ranges.push({
            start: start,
            end: end
        });
        start = end;
    }

    return ranges;
}

function translateSelectedTextsCloneTranslationTable(initialTranslationTable) {
    var clone = {};

    if (!initialTranslationTable || typeof initialTranslationTable !== "object") {
        return clone;
    }

    for (var key in initialTranslationTable) {
        if (translateSelectedTextsHasOwn(initialTranslationTable, key)) {
            clone[key] = translateSelectedTextsNormalizeString(initialTranslationTable[key]);
        }
    }

    return clone;
}

function translateSelectedTextsCollectEmptyEntries(entries, translationTable) {
    var emptyEntries = [];

    for (var i = 0; i < entries.length; i++) {
        var entryKey = translateSelectedTextsGetEntryTranslationKey(entries[i]);
        var lookup = translateSelectedTextsLookupTranslation(translationTable, entryKey);
        if (!lookup.found && entryKey !== entries[i].originalText) {
            lookup = translateSelectedTextsLookupTranslation(translationTable, entries[i].originalText);
        }
        if (!lookup.found || lookup.value.length === 0) {
            emptyEntries.push(entryKey);
        }
    }

    return emptyEntries;
}

function translateSelectedTextsCapturePageTranslations(fields, translationTable) {
    for (var i = 0; i < fields.length; i++) {
        translationTable[fields[i].entryKey] = translateSelectedTextsNormalizeString(fields[i].edit.text);
    }

    return translationTable;
}

function translateSelectedTextsBuildTranslationDialogPage(entries, pageIndex, pageCount, pageRange, translationTable) {
    var pageEntries = [];
    for (var i = pageRange.start; i < pageRange.end; i++) {
        pageEntries.push(entries[i]);
    }

    var pageLabel = "Page " + (pageIndex + 1) + " of " + pageCount;
    var win = new Window("dialog", "Translate Selected Texts - " + pageLabel);
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 8;
    win.spacing = 2;

    var introText = "Enter translations.";

    var intro = win.add("statictext", undefined, introText, { multiline: true });
    intro.alignment = ["fill", "top"];
    try {
        intro.maximumSize.height = intro.preferredSize.height;
    } catch (introSizeError) {
        // Ignore sizing failures and keep the dialog usable.
    }

    var listPanel = win.add("panel", undefined, "Translation table");
    listPanel.orientation = "column";
    listPanel.alignChildren = ["fill", "top"];
    listPanel.margins = 6;

    var fields = [];

    for (var j = 0; j < pageEntries.length; j++) {
        var row = listPanel.add("group");
        row.orientation = "column";
        row.alignChildren = ["fill", "top"];
        row.margins = 0;

        var labelText = translateSelectedTextsLabelText(pageEntries[j].originalText);
        if (pageEntries[j].isGroupEntry) {
            labelText = "[Group] " + pageEntries[j].parts.length + " item(s): " + labelText;
        }
        var label = row.add("statictext", undefined, (pageRange.start + j + 1) + ". " + labelText);
        label.characters = 60;

        var entryKey = translateSelectedTextsGetEntryTranslationKey(pageEntries[j]);
        var initialValue = "";
        if (translationTable && translateSelectedTextsHasOwn(translationTable, entryKey)) {
            initialValue = translateSelectedTextsNormalizeString(translationTable[entryKey]);
        } else if (translationTable && translateSelectedTextsHasOwn(translationTable, pageEntries[j].originalText)) {
            initialValue = translateSelectedTextsNormalizeString(translationTable[pageEntries[j].originalText]);
        }

        var edit = row.add("edittext", undefined, initialValue, { multiline: !!pageEntries[j].isGroupEntry });
        edit.characters = 60;
        if (pageEntries[j].isGroupEntry) {
            edit.preferredSize.height = 72;
        }

        fields.push({ originalText: pageEntries[j].originalText, entryKey: entryKey, edit: edit });
    }

    var buttonGroup = win.add("group");
    buttonGroup.alignment = "right";

    var accepted = false;
    var result = null;
    var isLastPage = pageIndex === pageCount - 1;

    var previousButton = buttonGroup.add("button", undefined, "Previous");
    var nextButton = buttonGroup.add("button", undefined, "Next", { name: "ok" });
    var translateButton = buttonGroup.add("button", undefined, "Translate");
    var cancelButton = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

    previousButton.enabled = pageIndex > 0;
    nextButton.enabled = !isLastPage;
    translateButton.enabled = true;

    previousButton.onClick = function () {
        accepted = true;
        result = {
            action: "prev",
            translationTable: translateSelectedTextsCapturePageTranslations(fields, translationTable)
        };
        win.close();
    };

    nextButton.onClick = function () {
        accepted = true;
        result = {
            action: "next",
            translationTable: translateSelectedTextsCapturePageTranslations(fields, translationTable)
        };
        win.close();
    };

    translateButton.onClick = function () {
        accepted = true;
        result = {
            action: "translate",
            translationTable: translateSelectedTextsCapturePageTranslations(fields, translationTable)
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

function translateSelectedTextsBuildTranslationDialog(entries, initialTranslationTable) {
    var pageRanges = translateSelectedTextsBuildDialogPageRanges(entries);
    var translationTable = translateSelectedTextsCloneTranslationTable(initialTranslationTable);
    var currentPage = 0;

    while (currentPage >= 0 && currentPage < pageRanges.length) {
        var pageResult = translateSelectedTextsBuildTranslationDialogPage(entries, currentPage, pageRanges.length, pageRanges[currentPage], translationTable);

        if (!pageResult) {
            return null;
        }

        translationTable = pageResult.translationTable;

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

    return {
        translationTable: translationTable,
        emptyEntries: translateSelectedTextsCollectEmptyEntries(entries, translationTable)
    };
}

function translateSelectedTextsRunInteractiveWithMode(replaceModeInput, emptyEntryActionInput) {
    var replaceMode = translateSelectedTextsNormalizeGroupReplaceMode(replaceModeInput);
    var entries = translateSelectedTextsCollectEntries(replaceMode);
    translateSelectedTextsSortEntriesForDisplay(entries);
    var prefillTranslationTable = null;
    var hasDefaultEmptyEntryAction = arguments.length > 1;
    var defaultEmptyEntryAction = translateSelectedTextsNormalizeEmptyEntryAction(emptyEntryActionInput);

    while (true) {
        var translationDialogResult = translateSelectedTextsBuildTranslationDialog(entries, prefillTranslationTable);

        if (!translationDialogResult) {
            return "Translation cancelled by user.";
        }

        prefillTranslationTable = translationDialogResult.translationTable;

        var emptyEntryAction = "leave";
        if (translationDialogResult.emptyEntries && translationDialogResult.emptyEntries.length > 0) {
            if (hasDefaultEmptyEntryAction) {
                emptyEntryAction = defaultEmptyEntryAction;
            } else {
                var emptyEntryActionResult = translateSelectedTextsBuildEmptyEntryActionDialog(translationDialogResult.emptyEntries.length, emptyEntryAction);
                if (!emptyEntryActionResult) {
                    continue;
                }

                emptyEntryAction = emptyEntryActionResult;
            }
        }

        var translatedCount = translateSelectedTextsTranslateEntries(entries, translationDialogResult.translationTable, emptyEntryAction);

        return "Translated " + translatedCount + " selected text item(s).";
    }
}

function translateSelectedTextsRunInteractive(replaceModeInput) {
    var replaceMode = translateSelectedTextsBuildGroupReplacementModeDialog(replaceModeInput);

    if (!replaceMode) {
        return "Translation cancelled by user.";
    }

    return translateSelectedTextsRunInteractiveWithMode(replaceMode);
}

function translateSelectedTextsRunHeadless(translationTableInput, replaceModeInput, emptyEntryActionInput) {
    var entries = translateSelectedTextsCollectEntries(replaceModeInput);
    var translationTable = translateSelectedTextsParseTranslationTable(translationTableInput);
    var translatedCount;

    if (emptyEntryActionInput === null || typeof emptyEntryActionInput === "undefined" || emptyEntryActionInput === "") {
        translatedCount = translateSelectedTextsTranslateEntries(entries, translationTable);
    } else {
        translatedCount = translateSelectedTextsTranslateEntries(entries, translationTable, emptyEntryActionInput);
    }

    return "Translated " + translatedCount + " selected text item(s).";
}
