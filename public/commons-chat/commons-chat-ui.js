(function () {
  const CIVIC_ORIGIN = "https://ealing.civiccommons.co.uk";
  const REPORT_ENDPOINT = CIVIC_ORIGIN + "/.netlify/functions/commons-chat-report";
  const GUIDELINES_URL = CIVIC_ORIGIN + "/community-guidelines/";
  const ABOUT_CHAT_URL = CIVIC_ORIGIN + "/commons-chat/about.html";
  const ROADMAP_URL = CIVIC_ORIGIN + "/roadmap.html";
  const DOCUMENTS_URL = CIVIC_ORIGIN + "/documents/";
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

    if (mainMenu && !mainMenu.querySelector (".commons-guidelines-link")) {
      const row = document.createElement ("li");
      row.className = "commons-guidelines-link";
      const link = document.createElement ("a");
      link.href = GUIDELINES_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Community guidelines";
      row.appendChild (link);
      mainMenu.appendChild (row);
    }

    if (mainMenu && !mainMenu.querySelector (".commons-about-chat-link")) {
      [
        ["About Commons Chat", ABOUT_CHAT_URL, "commons-about-chat-link"],
        ["Roadmap", ROADMAP_URL, "commons-roadmap-link"],
        ["Civic Commons documents", DOCUMENTS_URL, "commons-documents-link"]
      ].forEach (function (entry) {
        const row = document.createElement ("li");
        row.className = entry[2];
        const link = document.createElement ("a");
        link.href = entry[1];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = entry[0];
        row.appendChild (link);
        mainMenu.appendChild (row);
      });
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
        '<p class="commons-context-privacy"><strong>Conversations are public.</strong> Your sign-in email is private and is not shown publicly.</p>' +
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
        '<p class="commons-context-privacy"><strong>Conversations are public.</strong> Your sign-in email is private and is not shown publicly.</p>' +
        '<p class="commons-context-copy"><a class="commons-context-link" href="' + CIVIC_ORIGIN + '/">Browse the Civic Commons ↗</a></p>';
    }

    container.parentNode.insertBefore (banner, container);
  }

  function installWelcomePanel () {
    const banner = document.getElementById ("idCommonsContextBanner");
    if (!banner || !window.globals || !globals.myRssNetwork) return;

    const existing = document.getElementById ("idCommonsWelcome");
    if (globals.myRssNetwork.userIsSignedIn ()) {
      if (existing) existing.remove ();
      return;
    }
    if (existing) return;

    const welcome = document.createElement ("section");
    welcome.id = "idCommonsWelcome";
    welcome.className = "commons-welcome";
    welcome.setAttribute ("aria-labelledby", "idCommonsWelcomeTitle");

    const title = document.createElement ("h2");
    title.id = "idCommonsWelcomeTitle";
    title.textContent = "Join the conversation";

    const intro = document.createElement ("p");
    intro.textContent = "Anyone can read Commons Chat. To post or reply, create an account using your email address.";

    const steps = document.createElement ("ol");
    [
      "Choose Join Commons Chat.",
      "Enter your email address and choose a username.",
      "Use the sign-in link sent to your email, then start posting."
    ].forEach (function (text) {
      const li = document.createElement ("li");
      li.textContent = text;
      steps.appendChild (li);
    });

    const privacy = document.createElement ("p");
    privacy.className = "commons-welcome-privacy";
    privacy.innerHTML = "<strong>Your email address stays private.</strong> Your profile name and anything you publish are public.";

    const actions = document.createElement ("div");
    actions.className = "commons-welcome-actions";

    const join = document.createElement ("button");
    join.type = "button";
    join.className = "commons-welcome-primary";
    join.textContent = "Join Commons Chat";
    join.addEventListener ("click", function () {
      if (typeof window.createAccountCommand === "function") window.createAccountCommand ();
    });

    const signIn = document.createElement ("button");
    signIn.type = "button";
    signIn.className = "commons-welcome-secondary";
    signIn.textContent = "Already have an account? Sign in";
    signIn.addEventListener ("click", function () {
      if (typeof window.signInCommand === "function") window.signInCommand ();
    });

    const learn = document.createElement ("a");
    learn.href = ABOUT_CHAT_URL;
    learn.target = "_blank";
    learn.rel = "noopener noreferrer";
    learn.textContent = "How Commons Chat works ↗";

    actions.append (join, signIn, learn);
    welcome.append (title, intro, steps, privacy, actions);
    banner.appendChild (welcome);
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

  function closeReportDialog () {
    const overlay = document.getElementById ("idCommonsReportOverlay");
    if (overlay) overlay.remove ();
  }

  function plainPostExcerpt (item) {
    const raw = item?.markdowntext || item?.description || item?.title || "";
    const div = document.createElement ("div");
    div.innerHTML = String (raw);
    return (div.textContent || div.innerText || String (raw))
      .replace (/\s+/g, " ")
      .trim ()
      .slice (0, 1000);
  }

  function reportPostUrl (item) {
    if (item?.guid) return item.guid;
    if (item?.id !== undefined) return window.location.origin + "/?id=" + encodeURIComponent (item.id);
    return window.location.href;
  }

  function openReportDialog (item) {
    closeReportDialog ();

    const overlay = document.createElement ("div");
    overlay.id = "idCommonsReportOverlay";
    overlay.className = "commons-report-overlay";

    const dialog = document.createElement ("section");
    dialog.className = "commons-report-dialog";
    dialog.setAttribute ("role", "dialog");
    dialog.setAttribute ("aria-modal", "true");
    dialog.setAttribute ("aria-labelledby", "idCommonsReportTitle");

    const header = document.createElement ("header");
    header.className = "commons-report-header";
    const copy = document.createElement ("div");
    const eyebrow = document.createElement ("p");
    eyebrow.className = "commons-settings-eyebrow";
    eyebrow.textContent = "Commons Chat";
    const heading = document.createElement ("h1");
    heading.id = "idCommonsReportTitle";
    heading.textContent = "Report this post";
    const intro = document.createElement ("p");
    intro.textContent = "Reports go to the Civic Commons moderation queue. Reporting a post does not remove it automatically.";
    copy.append (eyebrow, heading, intro);
    const close = document.createElement ("button");
    close.type = "button";
    close.className = "commons-settings-close";
    close.setAttribute ("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener ("click", closeReportDialog);
    header.append (copy, close);

    const form = document.createElement ("div");
    form.className = "commons-report-body";

    const reasonLabel = document.createElement ("label");
    reasonLabel.className = "commons-settings-field";
    const reasonText = document.createElement ("span");
    reasonText.className = "commons-settings-label";
    reasonText.textContent = "Why are you reporting this?";
    const reason = document.createElement ("select");
    [
      ["", "Choose a reason…"],
      ["abuse-or-harassment", "Abuse or harassment"],
      ["hate-or-discrimination", "Hate or discrimination"],
      ["threats-or-safety", "Threats or immediate safety concern"],
      ["spam-or-manipulation", "Spam or manipulation"],
      ["private-information", "Private or personal information"],
      ["other", "Something else"]
    ].forEach (function (pair) {
      const option = document.createElement ("option");
      option.value = pair[0];
      option.textContent = pair[1];
      reason.appendChild (option);
    });
    reasonLabel.append (reasonText, reason);

    const detailLabel = document.createElement ("label");
    detailLabel.className = "commons-settings-field";
    const detailText = document.createElement ("span");
    detailText.className = "commons-settings-label";
    detailText.textContent = "Anything the moderator should know? (optional)";
    const details = document.createElement ("textarea");
    details.rows = 4;
    details.maxLength = 2000;
    details.placeholder = "Add context that will help us review the post.";
    detailLabel.append (detailText, details);

    const standards = document.createElement ("p");
    standards.className = "commons-report-guidelines";
    const standardsLink = document.createElement ("a");
    standardsLink.href = GUIDELINES_URL;
    standardsLink.target = "_blank";
    standardsLink.rel = "noopener noreferrer";
    standardsLink.textContent = "Read the Community Guidelines ↗";
    standards.append ("Not every disagreement is a moderation issue. ", standardsLink);

    form.append (reasonLabel, detailLabel, standards);

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
    cancel.addEventListener ("click", closeReportDialog);
    const submit = document.createElement ("button");
    submit.type = "button";
    submit.className = "commons-settings-save";
    submit.textContent = "Send report";

    submit.addEventListener ("click", async function () {
      if (!reason.value) {
        status.textContent = "Choose a reason first.";
        reason.focus ();
        return;
      }

      submit.disabled = true;
      cancel.disabled = true;
      status.textContent = "Sending…";

      let reportedBy = "";
      try {
        if (window.globals && globals.myRssNetwork && globals.myRssNetwork.userIsSignedIn ()) {
          reportedBy = globals.myRssNetwork.getScreenname () || "";
        }
      } catch {}

      try {
        const response = await fetch (REPORT_ENDPOINT, {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify ({
            postId: String (item?.id ?? ""),
            reason: reason.value,
            details: details.value.trim (),
            reportedBy
            })
          });
        const data = await response.json ().catch (function () { return {}; });
        if (!response.ok) throw new Error (data.error || "The report could not be sent.");

        status.textContent = "Report received. Thank you.";
        submit.textContent = "Reported ✓";
        window.setTimeout (closeReportDialog, 900);
      }
      catch (err) {
        submit.disabled = false;
        cancel.disabled = false;
        status.textContent = err.message || "The report could not be sent.";
      }
    });

    buttons.append (cancel, submit);
    footer.append (status, buttons);
    dialog.append (header, form, footer);
    overlay.append (dialog);
    overlay.addEventListener ("click", function (event) {
      if (event.target === overlay) closeReportDialog ();
    });
    document.body.append (overlay);
    reason.focus ();
  }

  function installReportControl (thread, item) {
    if (!item || thread.find (".commons-report-button").length > 0) return;
    const body = thread.find (".divTweetBody").first ();
    if (!body.length) return;
    const actions = body.find (".divTweetActions").first ();
    if (!actions.length) return;

    const button = document.createElement ("button");
    button.type = "button";
    button.className = "commons-report-button";
    button.textContent = "Report";
    button.title = "Report this post for moderation review";
    button.addEventListener ("click", function (event) {
      event.preventDefault ();
      event.stopPropagation ();
      openReportDialog (item);
    });
    actions.append (button);
  }

  function installReadMoreControl (thread, item) {
    if (thread.find (".commons-read-more").length > 0) return;

    const renderedText = thread.find (".divTweetText").first ().text ();
    const plain = String (renderedText || item?.title || "")
      .replace (/\s+/g, " ")
      .trim ();

    if (plain.length < 700) return;

    const body = thread.find (".divTweetBody").first ();
    if (!body.length) return;

    const readMore = document.createElement ("button");
    readMore.type = "button";
    readMore.className = "commons-read-more";
    readMore.textContent = "Read more";
    readMore.setAttribute ("aria-label", "Read this post in full");
    readMore.addEventListener ("click", function (event) {
      event.preventDefault ();
      event.stopPropagation ();
      const url = window.location.origin + "/?id=" + encodeURIComponent (item.id);
      if (window.globals && globals.myChatUserInterface && typeof globals.myChatUserInterface.viewStory === "function") {
        history.pushState ({id: item.id}, "", url);
        globals.myChatUserInterface.viewStory (url);
      }
      else {
        window.location.href = url;
      }
    });

    const actions = body.find (".divTweetActions").first ();
    if (actions.length) {
      actions.before (readMore);
    }
    else {
      body.append (readMore);
    }
  }

  function decorateBoundPosts () {
    if (!window.jQuery) return;
    window.jQuery (".divThread").each (function () {
      const thread = window.jQuery (this);
      const item = thread.data ("item");
      if (!item) {
        return;
      }

      installReportControl (thread, item);
      installReadMoreControl (thread, item);

      if (!item.commonsObjectUrl || thread.find (".commons-object-card").length > 0) {
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
    advanced.addEventListener ("toggle", function () {
      window.requestAnimationFrame (updateScrollHint);
    });

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
    installWelcomePanel ();
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
      installWelcomePanel ();
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
