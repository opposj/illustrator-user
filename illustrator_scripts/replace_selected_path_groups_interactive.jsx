#target illustrator
/*
 * Interactive path-group replacement entrypoint for Illustrator.
 * This script opens a grouped preview-and-replacement dialog, then replaces
 * each selected path-only group with centered multiline text.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/replace_selected_path_groups_common.jsx"

(function () {
    try {
        replaceSelectedPathGroupsRunInteractive();
    } catch (error) {
        throw error;
    }
})();
