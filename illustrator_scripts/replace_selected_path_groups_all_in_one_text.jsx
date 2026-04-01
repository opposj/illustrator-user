#target illustrator
/*
 * All-in-one path-group replacement entrypoint for Illustrator.
 * This script opens a single prompt for the replacement text, rotation, and
 * text size factor, then applies the same replacement text to every eligible
 * selected path group.
 */

#include "d:/Lab/final_thesis/illustrator-user/illustrator_scripts/replace_selected_path_groups_common.jsx"

(function () {
    try {
        replaceSelectedPathGroupsRunAllInOneText();
    } catch (error) {
        throw error;
    }
})();
