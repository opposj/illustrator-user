#target illustrator
/*
 * Headless auto-grouping entrypoint for Illustrator paths and compound paths.
 * This script clusters nearby atomic PathItem and CompoundPathItem objects using
 * configurable horizontal and vertical bounding-box dilation factors before
 * rebuilding each result as a path-aware group.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/auto_group_paths_common.jsx"

(function () {
    try {
        var widthScaleFactor = 1.0;
        var heightScaleFactor = 1.0;
        var fillColorLimit = "#000000";
        var areaRangeMin = null;
        var areaRangeMax = null;
        var hasWidthScaleFactor = false;
        var hasHeightScaleFactor = false;

        try {
            if (typeof $.global.AUTO_GROUP_PATH_WIDTH_SCALE_FACTOR !== "undefined") {
                widthScaleFactor = parseFloat($.global.AUTO_GROUP_PATH_WIDTH_SCALE_FACTOR);
                hasWidthScaleFactor = true;
            }

            if (typeof $.global.AUTO_GROUP_PATH_HEIGHT_SCALE_FACTOR !== "undefined") {
                heightScaleFactor = parseFloat($.global.AUTO_GROUP_PATH_HEIGHT_SCALE_FACTOR);
                hasHeightScaleFactor = true;
            }

            if (typeof $.global.AUTO_GROUP_PATH_FILL_COLOR_LIMIT !== "undefined") {
                fillColorLimit = String($.global.AUTO_GROUP_PATH_FILL_COLOR_LIMIT);
            }

            if (!hasWidthScaleFactor && !hasHeightScaleFactor && typeof $.global.AUTO_GROUP_PATH_NEARNESS_SCALE_FACTOR !== "undefined") {
                widthScaleFactor = parseFloat($.global.AUTO_GROUP_PATH_NEARNESS_SCALE_FACTOR);
                heightScaleFactor = widthScaleFactor;
                hasWidthScaleFactor = true;
                hasHeightScaleFactor = true;
            } else if (!hasWidthScaleFactor && !hasHeightScaleFactor && typeof $.global.AUTO_GROUP_PATH_SCALE_FACTOR !== "undefined") {
                widthScaleFactor = parseFloat($.global.AUTO_GROUP_PATH_SCALE_FACTOR);
                heightScaleFactor = widthScaleFactor;
                hasWidthScaleFactor = true;
                hasHeightScaleFactor = true;
            }

            if (typeof $.global.AUTO_GROUP_PATH_AREA_RANGE_MIN !== "undefined") {
                areaRangeMin = parseFloat($.global.AUTO_GROUP_PATH_AREA_RANGE_MIN);
            }

            if (typeof $.global.AUTO_GROUP_PATH_AREA_RANGE_MAX !== "undefined") {
                areaRangeMax = parseFloat($.global.AUTO_GROUP_PATH_AREA_RANGE_MAX);
            }
        } catch (runtimeError) {
            widthScaleFactor = 1.0;
            heightScaleFactor = 1.0;
            areaRangeMin = null;
            areaRangeMax = null;
        }

        if (!hasWidthScaleFactor && hasHeightScaleFactor) {
            widthScaleFactor = heightScaleFactor;
        }

        if (!hasHeightScaleFactor && hasWidthScaleFactor) {
            heightScaleFactor = widthScaleFactor;
        }

        if (isNaN(widthScaleFactor) || widthScaleFactor <= 0) {
            widthScaleFactor = 1.0;
        }

        if (isNaN(heightScaleFactor) || heightScaleFactor <= 0) {
            heightScaleFactor = 1.0;
        }

        if (!fillColorLimit) {
            fillColorLimit = "#000000";
        }

        if (isNaN(areaRangeMin)) {
            areaRangeMin = null;
        }

        if (isNaN(areaRangeMax)) {
            areaRangeMax = null;
        }

        return pathGroupRunHeadless(widthScaleFactor, heightScaleFactor, fillColorLimit, areaRangeMin, areaRangeMax);
    } catch (error) {
        throw error;
    }
})();
