#target illustrator
/*
 * Headless job export entrypoint for the selected-text translation workflow.
 * This script serializes the current selection into a JSON job payload so an
 * external LLM can translate the entries before the existing headless apply step.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/translate_selected_texts_common.jsx"

(function () {
    try {
        var replaceMode = null;
        if (typeof $.global.TRANSLATE_SELECTED_TEXTS_GROUP_REPLACE_MODE !== "undefined") {
            replaceMode = $.global.TRANSLATE_SELECTED_TEXTS_GROUP_REPLACE_MODE;
        }

        var outputPath = null;
        if (typeof $.global.TRANSLATE_SELECTED_TEXTS_JOB_OUTPUT_PATH !== "undefined") {
            outputPath = $.global.TRANSLATE_SELECTED_TEXTS_JOB_OUTPUT_PATH;
        }

        var serializedJob = translateSelectedTextsSerializeJobPayload(replaceMode);

        if (outputPath) {
            translateSelectedTextsWriteTextFile(outputPath, serializedJob);
        }

        return serializedJob;
    } catch (error) {
        throw error;
    }
})();
