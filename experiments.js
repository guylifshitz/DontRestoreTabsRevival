"use strict";

var { Services } = ChromeUtils.import(
    "resource://gre/modules/Services.jsm");
var { ExtensionSupport } = ChromeUtils.import(
    "resource:///modules/ExtensionSupport.jsm");
var { ExtensionParent } = ChromeUtils.import(
    "resource://gre/modules/ExtensionParent.jsm");
    var { SessionStoreManager } = ChromeUtils.import(
        "resource:///modules/SessionStoreManager.jsm"
      );

const EXTENSION_NAME = "DontRestoreTabsRevival@nuitcodecitoyen.org";
var extension = ExtensionParent.GlobalManager.getExtension(EXTENSION_NAME);

// Implements the functions defined in the experiments section of schema.json.
var dontRestoreTabsRevival = class extends ExtensionCommon.ExtensionAPI {
    onStartup() {
    }

    onShutdown(isAppShutdown) {
        if (isAppShutdown) return;
        // Looks like we got uninstalled. Maybe a new version will be installed
        // now. Due to new versions not taking effect
        // (https://bugzilla.mozilla.org/show_bug.cgi?id=1634348)
        // we invalidate the startup cache. That's the same effect as starting
        // with -purgecaches (or deleting the startupCache directory from the
        // profile).
        Services.obs.notifyObservers(null, "startupcache-invalidate");
    }

    getAPI(context) {
        context.callOnClose(this);
        return {
          dontRestoreTabsRevival: {
                addWindowListener(dummy) {
                    var prefix = "chrome://messenger/content/";
                    var windows = [
                        "addressbook/addressbook",
                        "messenger",
                        "messageWindow",
                        "messengercompose/messengercompose",
                    ];
                    var suffixes = ["xul", "xhtml"];
                    var urls = suffixes.map(s => windows.map(
                        w => prefix + w + "." + s)).flat(1);
                    // Adds a listener to detect new windows.
                    ExtensionSupport.registerWindowListener(EXTENSION_NAME, {
                        chromeURLs: urls,
                        onLoadWindow: paint,
                    });
                }
            }
        }
    }

    close() {
        ExtensionSupport.unregisterWindowListener(EXTENSION_NAME);
    }
};


function paint(win) {
    if (win.location == "chrome://messenger/content/messenger.xul" ||
    win.location == "chrome://messenger/content/messenger.xhtml") {
        win.setTimeout(function () {
        try {
            win.atStartupRestoreTabs = async function(aDontRestoreFirstTab) {
                let state = await SessionStoreManager.loadingWindow(win);
                if (state) {
                  let tabsState = state.tabs;

                  // Either we can chose not to open the message tabs, or close all tabs.
                //   let tabsStateTabsNoMFessages = tabsState.tabs.filter(tab => tab.mode != "message");
                  tabsState.tabs = [];
                    let tabmail = win.document.getElementById("tabmail");
                    tabmail.restoreTabs(tabsState, aDontRestoreFirstTab);
                }

                // it's now safe to load extra Tabs.
                Services.tm.dispatchToMainThread(win.loadExtraTabs);
                SessionStoreManager._restored = true;
                Services.obs.notifyObservers(win, "mail-tabs-session-restored");
                return !!state;
              }
        } catch (e) {
            console.log("Components.utils.reportError(e);");
          Components.utils.reportError(e);
        }
      }, 10);
    }
}
