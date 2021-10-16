"use strict";

/* globals browser */

var init = async () => {
    browser.dontRestoreTabsRevival.addWindowListener("dummy");
};

init();
