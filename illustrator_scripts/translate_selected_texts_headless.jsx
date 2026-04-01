#target illustrator
/*
 * Headless translation entrypoint for Illustrator.
 * Set TRANSLATION_TABLE_JSON before running this script, then it will translate
 * the currently selected English text objects in place and keep their styling.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/translate_selected_texts_common.jsx"

(function () {
    try {
        if (typeof $.global.TRANSLATION_TABLE_JSON === "undefined" || $.global.TRANSLATION_TABLE_JSON === null || $.global.TRANSLATION_TABLE_JSON === "") {
            throw new Error("Headless mode requires $.global.TRANSLATION_TABLE_JSON to be set to a JSON object string.");
        }

        var replaceMode = null;
        if (typeof $.global.TRANSLATE_SELECTED_TEXTS_GROUP_REPLACE_MODE !== "undefined") {
            replaceMode = $.global.TRANSLATE_SELECTED_TEXTS_GROUP_REPLACE_MODE;
        }

        var emptyEntryAction = null;
        if (typeof $.global.TRANSLATE_SELECTED_TEXTS_EMPTY_ENTRY_ACTION !== "undefined") {
            emptyEntryAction = $.global.TRANSLATE_SELECTED_TEXTS_EMPTY_ENTRY_ACTION;
        }

        return translateSelectedTextsRunHeadless($.global.TRANSLATION_TABLE_JSON, replaceMode, emptyEntryAction);
    } catch (error) {
        throw error;
    }
})();
