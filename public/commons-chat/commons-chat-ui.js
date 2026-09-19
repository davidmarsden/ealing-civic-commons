(function () {
  const CIVIC_ORIGIN = "https://ealing.civiccommons.co.uk";
  const OAK_URL = CIVIC_ORIGIN + "/brand/ealing-oak-approved.webp";
  const params = new URLSearchParams (window.location.search);
  const commonsObjectUrl = params.get ("commonsObjectUrl");
  const commonsObjectType = params.get ("commonsObjectType") || "item";
  const commonsObjectTitle = params.get ("commonsObjectTitle") || "Civic Commons item";
  const flCompose = params.get ("compose") === "1";
  let flNetworkPatched = false;
  let flComposerOpened = false;

  function setTextForOnclick (needle, text, flHide) {
    document.querySelectorAll ("a[onclick]").forEach (function (link) {
      const onclick = link.getAttribute ("onclick") || "";
      if (onclick.indexOf (needle) >= 0) {
        if (flHide) {
          const row = link.closest ("li");
          if (row) row.style.display = "none";
        }
        else if (link.textContent !== text) {
          link.textContent = text;
        }
      }
    });
  }

  function replaceInterfaceText (selector, from, to) {
    document.querySelectorAll (selector).forEach (function (el) {
      if (el.textContent.trim () === from && el.textContent !== to) {
        el.textContent = to;
      }
    });
  }

  function installBranding () {
    if (document.title !== "Conversations — Ealing Civic Commons") {
      document.title = "Conversations — Ealing Civic Commons";
    }

    const brand = document.querySelector (".navbar .brand");
    if (brand && !brand.dataset.commonsBranded) {
      brand.dataset.commonsBranded = "true";
      brand.href = CIVIC_ORIGIN + "/";
      brand.title = "Back to Ealing Civic Commons";
      brand.innerHTML =
        '<img class="commons-brand-oak" src="' + OAK_URL + '" alt="">' +
        '<span class="commons-brand-copy">' +
        '<span class="commons-brand-name">Ealing Civic Commons</span>' +
        '<span class="commons-brand-section">Conversations</span>' +
        '</span>';
    }

    const mainToggle = document.querySelector ("#idMainMenu > a");
    if (mainToggle && mainToggle.childNodes.length > 0 && mainToggle.childNodes[0].nodeValue !== "More ") {
      mainToggle.childNodes[0].nodeValue = "More ";
    }

    const docs = document.getElementById ("idDocsMenu");
    if (docs) docs.style.display = "none";

    setTextForOnclick ("newPostCommand", "Start a conversation…", false);
    setTextForOnclick ("showEditorCommand", "", true);
    setTextForOnclick ("viewMyFeedCommand", "", true);
    setTextForOnclick ("viewEveryonesFeedCommand", "", true);
    setTextForOnclick ("viewUserlistCommand", "", true);
    setTextForOnclick ("versionsDialog", "", true);
    setTextForOnclick ("settingsCommand", "Profile & settings…", false);
    setTextForOnclick ("createAccountCommand", "Join Commons Chat…", false);
    setTextForOnclick ("signInCommand", "Sign in…", false);

    replaceInterfaceText (".divIconsContainer .spanIconLabel", "Home", "Conversations");
    replaceInterfaceText (".divIconsContainer .spanIconLabel", "New post", "Start a conversation");
    replaceInterfaceText (".divIconsContainer .spanIconLabel", "Your feed", "My posts");
    replaceInterfaceText (".divIconsContainer .spanIconLabel", "Your prefs", "Profile & settings");
    replaceInterfaceText (".buttonPost", "Post", "Publish");

    const mainMenu = document.querySelector ("#idMainMenu .dropdown-menu");
    if (mainMenu && !mainMenu.querySelector (".commons-about-link")) {
      const divider = document.createElement ("li");
      divider.className = "divider commons-about-link";
      const row = document.createElement ("li");
      row.className = "commons-about-link";
      const link = document.createElement ("a");
      link.href = CIVIC_ORIGIN + "/";
      link.textContent = "Back to Civic Commons";
      row.appendChild (link);
      mainMenu.appendChild (divider);
      mainMenu.appendChild (row);
    }
  }

  function installContextBanner () {
    if (document.getElementById ("idCommonsContextBanner")) {
      return;
    }
    const container = document.querySelector (".divChatContainer");
    if (!container) return;

    const banner = document.createElement ("section");
    banner.id = "idCommonsContextBanner";

    if (commonsObjectUrl) {
      banner.innerHTML =
        '<p class="commons-context-eyebrow">Civic Commons discussion</p>' +
        '<h1 class="commons-context-title"></h1>' +
        '<p class="commons-context-copy">Talk about this civic item here. The conversation stays linked to the public record.</p>' +
        '<p class="commons-context-copy"><a class="commons-context-link" target="_blank" rel="noopener noreferrer">Back to the civic item ↗</a></p>';
      banner.querySelector (".commons-context-title").textContent = commonsObjectTitle;
      const link = banner.querySelector (".commons-context-link");
      link.href = commonsObjectUrl;
    }
    else {
      banner.innerHTML =
        '<p class="commons-context-eyebrow">Ealing Civic Commons</p>' +
        '<h1 class="commons-context-title">Conversations</h1>' +
        '<p class="commons-context-copy">A place to talk about what is happening across Ealing. Conversations started from a Civic Commons item stay connected to that public record.</p>' +
        '<p class="commons-context-copy"><a class="commons-context-link" href="' + CIVIC_ORIGIN + '/">Browse the Civic Commons ↗</a></p>';
    }

    container.parentNode.insertBefore (banner, container);
  }

  function patchNetwork () {
    if (!commonsObjectUrl || flNetworkPatched || !window.globals || !globals.myRssNetwork) {
      return;
    }
    const originalNewPost = globals.myRssNetwork.newPost.bind (globals.myRssNetwork);
    globals.myRssNetwork.newPost = function (postRec, callback) {
      if (postRec && postRec.commonsObjectUrl === undefined) {
        postRec.commonsObjectUrl = commonsObjectUrl;
        postRec.commonsObjectType = commonsObjectType;
      }
      return originalNewPost (postRec, callback);
    };
    flNetworkPatched = true;
  }

  function openComposer () {
    if (!flCompose || flComposerOpened || !window.globals || !globals.myChatUserInterface || !globals.myRssNetwork) {
      return;
    }
    if (!globals.myRssNetwork.userIsSignedIn ()) {
      return;
    }
    globals.myChatUserInterface.editNewItem ();
    flComposerOpened = true;
  }

  function civicLabelFor (item) {
    if (commonsObjectUrl && item.commonsObjectUrl === commonsObjectUrl) {
      return commonsObjectTitle;
    }
    return "Civic Commons item";
  }

  function decorateBoundPosts () {
    if (!window.jQuery) return;
    window.jQuery (".divThread").each (function () {
      const thread = window.jQuery (this);
      const item = thread.data ("item");
      if (!item || !item.commonsObjectUrl || thread.find (".commons-object-card").length > 0) {
        return;
      }

      const body = thread.find (".divTweetBody").first ();
      if (!body.length) return;

      const card = document.createElement ("div");
      card.className = "commons-object-card";

      const label = document.createElement ("strong");
      label.textContent = "Linked to Civic Commons";

      const title = document.createElement ("span");
      title.textContent = civicLabelFor (item);

      const link = document.createElement ("a");
      link.className = "commons-object-link";
      link.href = item.commonsObjectUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View the civic item ↗";

      card.append (label, title, link);

      const actions = body.find (".divTweetActions").first ();
      if (actions.length) {
        actions.before (card);
      }
      else {
        body.append (card);
      }
    });
  }

  function getCurrentPrefs () {
    const saved = (window.globals && globals.userData && globals.userData.prefs) ? globals.userData.prefs : {};
    const current = (typeof window.appPrefs === "object" && window.appPrefs) ? window.appPrefs : {};
    return Object.assign ({}, current, saved);
  }

  function closeCommonsSettings () {
    const overlay = document.getElementById ("idCommonsSettingsOverlay");
    if (overlay) overlay.remove ();
  }

  function makeField (labelText, input) {
    const label = document.createElement ("label");
    label.className = "commons-settings-field";
    const labelSpan = document.createElement ("span");
    labelSpan.className = "commons-settings-label";
    labelSpan.textContent = labelText;
    label.append (labelSpan, input);
    return label;
  }

  function openCommonsSettings () {
    if (!window.globals || !globals.myRssNetwork || !globals.myRssNetwork.userIsSignedIn ()) {
      if (typeof window.signInCommand === "function") window.signInCommand ();
      return;
    }

    closeCommonsSettings ();

    const prefs = getCurrentPrefs ();
    const overlay = document.createElement ("div");
    overlay.id = "idCommonsSettingsOverlay";
    overlay.className = "commons-settings-overlay";

    const dialog = document.createElement ("section");
    dialog.className = "commons-settings-dialog";
    dialog.setAttribute ("role", "dialog");
    dialog.setAttribute ("aria-modal", "true");
    dialog.setAttribute ("aria-labelledby", "idCommonsSettingsTitle");

    const header = document.createElement ("header");
    header.className = "commons-settings-header";
    const headingWrap = document.createElement ("div");
    const eyebrow = document.createElement ("p");
    eyebrow.className = "commons-settings-eyebrow";
    eyebrow.textContent = "Ealing Civic Commons";
    const heading = document.createElement ("h1");
    heading.id = "idCommonsSettingsTitle";
    heading.textContent = "Your profile & settings";
    const intro = document.createElement ("p");
    intro.textContent = "Choose how you appear in conversations. The technical bits stay out of the way.";
    headingWrap.append (eyebrow, heading, intro);
    const closeButton = document.createElement ("button");
    closeButton.type = "button";
    closeButton.className = "commons-settings-close";
    closeButton.setAttribute ("aria-label", "Close");
    closeButton.textContent = "×";
    closeButton.addEventListener ("click", closeCommonsSettings);
    header.append (headingWrap, closeButton);

    const body = document.createElement ("div");
    body.className = "commons-settings-body";

    const identity = document.createElement ("section");
    identity.className = "commons-settings-section";
    const identityTitle = document.createElement ("h2");
    identityTitle.textContent = "How people see you";

    const profileGrid = document.createElement ("div");
    profileGrid.className = "commons-settings-profile-grid";

    const avatarWrap = document.createElement ("div");
    avatarWrap.className = "commons-settings-avatar-wrap";
    const avatar = document.createElement ("div");
    avatar.className = "commons-settings-avatar";
    const avatarImg = document.createElement ("img");
    avatarImg.alt = "";
    const fallback = document.createElement ("span");
    fallback.textContent = ((prefs.myFeedTitle || globals.myRssNetwork.getScreenname () || "?").trim ()[0] || "?").toUpperCase ();
    avatar.append (avatarImg, fallback);
    avatarWrap.append (avatar);

    const fields = document.createElement ("div");
    fields.className = "commons-settings-fields";

    const nameInput = document.createElement ("input");
    nameInput.type = "text";
    nameInput.maxLength = 80;
    nameInput.value = prefs.myFeedTitle || "";
    nameInput.placeholder = "The name you want people to see";

    const bioInput = document.createElement ("textarea");
    bioInput.rows = 4;
    bioInput.maxLength = 400;
    bioInput.value = prefs.myFeedDescription || "";
    bioInput.placeholder = "A short introduction — optional";

    const websiteInput = document.createElement ("input");
    websiteInput.type = "url";
    websiteInput.value = prefs.myFeedLink || "";
    websiteInput.placeholder = "https://…";

    const avatarInput = document.createElement ("input");
    avatarInput.type = "url";
    avatarInput.value = prefs.myAvatarImageUrl || "";
    avatarInput.placeholder = "https://…";

    function updateAvatarPreview () {
      const url = avatarInput.value.trim ();
      if (url) {
        avatarImg.src = url;
        avatarImg.hidden = false;
        fallback.hidden = true;
      }
      else {
        avatarImg.removeAttribute ("src");
        avatarImg.hidden = true;
        fallback.hidden = false;
      }
    }
    avatarImg.addEventListener ("error", function () {
      avatarImg.hidden = true;
      fallback.hidden = false;
    });
    avatarInput.addEventListener ("input", updateAvatarPreview);
    nameInput.addEventListener ("input", function () {
      fallback.textContent = ((nameInput.value || globals.myRssNetwork.getScreenname () || "?").trim ()[0] || "?").toUpperCase ();
    });
    updateAvatarPreview ();

    fields.append (
      makeField ("Display name", nameInput),
      makeField ("About you", bioInput),
      makeField ("Website", websiteInput),
      makeField ("Profile picture", avatarInput)
      );
    profileGrid.append (avatarWrap, fields);
    identity.append (identityTitle, profileGrid);

    const account = document.createElement ("section");
    account.className = "commons-settings-section commons-settings-account";
    const accountTitle = document.createElement ("h2");
    accountTitle.textContent = "Your account";
    const accountGrid = document.createElement ("div");
    accountGrid.className = "commons-settings-account-grid";

    function accountRow (labelText, valueText) {
      const row = document.createElement ("div");
      const label = document.createElement ("span");
      label.textContent = labelText;
      const value = document.createElement ("strong");
      value.textContent = valueText || "—";
      row.append (label, value);
      return row;
    }

    accountGrid.append (
      accountRow ("Username", globals.myRssNetwork.getScreenname ()),
      accountRow ("Email", globals.myRssNetwork.getEmail ())
      );
    const privacyNote = document.createElement ("p");
    privacyNote.className = "commons-settings-note";
    privacyNote.textContent = "Your email address is used for sign-in and is not shown publicly.";
    account.append (accountTitle, accountGrid, privacyNote);

    const writing = document.createElement ("section");
    writing.className = "commons-settings-section";
    const writingTitle = document.createElement ("h2");
    writingTitle.textContent = "Writing";

    const wordCountLabel = document.createElement ("label");
    wordCountLabel.className = "commons-settings-toggle";
    const wordCountInput = document.createElement ("input");
    wordCountInput.type = "checkbox";
    wordCountInput.checked = Boolean (prefs.flWordCount);
    const wordCountCopy = document.createElement ("span");
    const wordCountStrong = document.createElement ("strong");
    wordCountStrong.textContent = "Show word count";
    const wordCountSmall = document.createElement ("small");
    wordCountSmall.textContent = "A quiet count while you write.";
    wordCountCopy.append (wordCountStrong, wordCountSmall);
    wordCountLabel.append (wordCountInput, wordCountCopy);

    const editorLabel = document.createElement ("label");
    editorLabel.className = "commons-settings-field commons-settings-editor";
    const editorSpan = document.createElement ("span");
    editorSpan.className = "commons-settings-label";
    editorSpan.textContent = "Writing mode";
    const editorSelect = document.createElement ("select");
    const rich = document.createElement ("option");
    rich.value = "wizzy";
    rich.textContent = "Normal editor";
    const markdown = document.createElement ("option");
    markdown.value = "markdown";
    markdown.textContent = "Markdown";
    editorSelect.append (rich, markdown);
    editorSelect.value = prefs.defaultEditorMode === "markdown" ? "markdown" : "wizzy";
    editorLabel.append (editorSpan, editorSelect);

    writing.append (writingTitle, wordCountLabel, editorLabel);

    const advanced = document.createElement ("details");
    advanced.className = "commons-settings-advanced";
    const summary = document.createElement ("summary");
    summary.textContent = "Advanced";
    const advancedBody = document.createElement ("div");
    advancedBody.className = "commons-settings-advanced-body";
    const feedText = document.createElement ("p");
    feedText.textContent = "Your public posts are also available as an open web feed:";
    const feedLink = document.createElement ("a");
    feedLink.href = globals.myRssNetwork.getFeedUrl ();
    feedLink.target = "_blank";
    feedLink.rel = "noopener noreferrer";
    feedLink.textContent = "Open your public feed ↗";
    advancedBody.append (feedText, feedLink);
    advanced.append (summary, advancedBody);

    body.append (identity, account, writing, advanced);

    const scrollHint = document.createElement ("div");
    scrollHint.className = "commons-settings-scroll-hint";
    scrollHint.setAttribute ("aria-hidden", "true");
    scrollHint.textContent = "More settings below ↓";

    function updateScrollHint () {
      const canScroll = body.scrollHeight > body.clientHeight + 8;
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 12;
      scrollHint.hidden = !canScroll || atBottom;
    }
    body.addEventListener ("scroll", updateScrollHint, {passive: true});

    const footer = document.createElement ("footer");
    footer.className = "commons-settings-footer";
    const status = document.createElement ("p");
    status.className = "commons-settings-status";
    status.setAttribute ("aria-live", "polite");
    const buttons = document.createElement ("div");
    buttons.className = "commons-settings-buttons";
    const cancel = document.createElement ("button");
    cancel.type = "button";
    cancel.className = "commons-settings-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener ("click", closeCommonsSettings);
    const save = document.createElement ("button");
    save.type = "button";
    save.className = "commons-settings-save";
    save.textContent = "Save changes";

    save.addEventListener ("click", function () {
      const merged = Object.assign ({}, prefs, {
        myFeedTitle: nameInput.value.trim (),
        myFeedDescription: bioInput.value.trim (),
        myFeedLink: websiteInput.value.trim (),
        myAvatarImageUrl: avatarInput.value.trim (),
        flWordCount: wordCountInput.checked,
        defaultEditorMode: editorSelect.value
        });

      save.disabled = true;
      cancel.disabled = true;
      status.textContent = "Saving…";

      globals.myRssNetwork.savePrefs (merged, function (err) {
        if (err) {
          save.disabled = false;
          cancel.disabled = false;
          status.textContent = err.message || "Could not save your changes.";
          return;
        }

        if (globals.userData) globals.userData.prefs = merged;
        if (typeof window.appPrefs === "object" && window.appPrefs) {
          Object.assign (window.appPrefs, merged);
        }
        status.textContent = "Saved. Refreshing…";
        window.setTimeout (function () { window.location.reload (); }, 350);
        });
      });

    buttons.append (cancel, save);
    footer.append (status, buttons);
    dialog.append (header, body, scrollHint, footer);
    overlay.append (dialog);

    overlay.addEventListener ("click", function (event) {
      if (event.target === overlay) closeCommonsSettings ();
    });
    document.addEventListener ("keydown", function onKeydown (event) {
      if (event.key === "Escape" && document.getElementById ("idCommonsSettingsOverlay")) {
        closeCommonsSettings ();
        document.removeEventListener ("keydown", onKeydown);
      }
    });

    document.body.append (overlay);
    window.requestAnimationFrame (updateScrollHint);
    window.addEventListener ("resize", updateScrollHint, {once: true});
    nameInput.focus ();
  }

  function installFriendlySettings () {
    if (!window.globals || !globals.myRssNetwork) return;

    if (window.settingsCommand !== openCommonsSettings) {
      window.settingsCommand = openCommonsSettings;
    }

    if (!window.jQuery) return;
    window.jQuery (".divIconsContainer .divIcon").each (function () {
      const icon = window.jQuery (this);
      const label = icon.find (".spanIconLabel").text ().trim ();
      if (label === "Profile & settings") {
        const iconDef = icon.data ("iconDef");
        if (iconDef && iconDef.click !== openCommonsSettings) {
          iconDef.click = openCommonsSettings;
          iconDef.tooltip = "Change your profile and conversation settings.";
        }
        icon.attr ("title", "Profile & settings");
      }
    });
  }

  function tidyInterface () {
    installBranding ();
    installContextBanner ();
    patchNetwork ();
    openComposer ();
    decorateBoundPosts ();
    installFriendlySettings ();
  }

  let chatObserver;

  function startChatObserver () {
    const chatContainer = document.querySelector (".divChatContainer");
    if (!chatContainer || chatObserver) {
      return;
    }

    chatObserver = new MutationObserver (function () {
      decorateBoundPosts ();
      installBranding ();
      installFriendlySettings ();
    });

    chatObserver.observe (chatContainer, {childList: true, subtree: true});
  }

  const timer = window.setInterval (function () {
    tidyInterface ();
    startChatObserver ();
  }, 250);

  window.setTimeout (function () {
    window.clearInterval (timer);
  }, 15000);

  document.addEventListener ("DOMContentLoaded", function () {
    tidyInterface ();
    startChatObserver ();
  });
})();
