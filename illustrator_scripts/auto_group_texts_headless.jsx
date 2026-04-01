#target illustrator
/*
 * Headless auto-grouping entrypoint for Illustrator.
 * This script clusters nearby text objects using a configurable bounding-box
 * scale factor, then rebuilds each cluster as a text-only group.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/auto_group_texts_common.jsx"

(function () {
    try {
        var scaleFactor = 1.0;
        var textRegexPattern = null;

        try {
            if (typeof $.global.AUTO_GROUP_NEARNESS_SCALE_FACTOR !== "undefined") {
                scaleFactor = parseFloat($.global.AUTO_GROUP_NEARNESS_SCALE_FACTOR);
            } else if (typeof $.global.AUTO_GROUP_SCALE_FACTOR !== "undefined") {
                scaleFactor = parseFloat($.global.AUTO_GROUP_SCALE_FACTOR);
            }

            if (typeof $.global.AUTO_GROUP_TEXT_REGEX_PATTERN !== "undefined") {
                textRegexPattern = $.global.AUTO_GROUP_TEXT_REGEX_PATTERN;
            }
        } catch (scaleError) {
            scaleFactor = 1.0;
        }

        if (isNaN(scaleFactor) || scaleFactor <= 0) {
            scaleFactor = 1.0;
        }

        return autoGroupRunHeadless(scaleFactor, textRegexPattern);
    } catch (error) {
        throw error;
    }
})();
