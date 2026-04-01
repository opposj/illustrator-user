#target illustrator
/*
 * Interactive translation entrypoint for Illustrator.
 * This script opens a small GUI that lets you enter Chinese translations for
 * each selected English text object, then replaces the text in place.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/translate_selected_texts_common.jsx"

(function () {
    try {
        var replaceMode = null;
        if (typeof $.global.TRANSLATE_SELECTED_TEXTS_GROUP_REPLACE_MODE !== "undefined") {
            replaceMode = $.global.TRANSLATE_SELECTED_TEXTS_GROUP_REPLACE_MODE;
        }

        translateSelectedTextsRunInteractive(replaceMode);
    } catch (error) {
        throw error;
    }
})();
