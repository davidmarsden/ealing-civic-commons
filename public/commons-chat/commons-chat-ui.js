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

  function tidyInterface () {
    installBranding ();
    installContextBanner ();
    patchNetwork ();
    openComposer ();
    decorateBoundPosts ();
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
