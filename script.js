```js
"use strict";

/*
=========================================================
VOID.LINK
Frontend claim system
=========================================================
*/

console.log("🔥 VOID.LINK script.js LOADED 🔥");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🔥 VOID.LINK DOM READY 🔥");

  const forms =
    document.querySelectorAll("form.claim");

  console.log(
    "Claim forms found:",
    forms.length
  );

  if (!forms.length) {
    console.error(
      "❌ No form.claim elements found."
    );

    return;
  }


  /*
  -------------------------------------------------------
  Toast
  -------------------------------------------------------
  */

  const toast =
    document.querySelector(".toast");


  function msg(text) {
    console.log(
      "VOID.LINK:",
      text
    );

    if (!toast) {
      return;
    }

    toast.textContent = text;

    toast.classList.add("show");

    clearTimeout(
      window.__voidToastTimer
    );

    window.__voidToastTimer =
      setTimeout(() => {
        toast.classList.remove("show");
      }, 3000);
  }


  /*
  -------------------------------------------------------
  Username normalization
  -------------------------------------------------------
  */

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9._-]/g,
        ""
      )
      .slice(0, 24);
  }


  /*
  -------------------------------------------------------
  Availability
  -------------------------------------------------------
  */

  let availabilityTimer = null;


  async function checkAvailability(
    form
  ) {
    const input =
      form.querySelector("input");

    if (!input) {
      return;
    }

    const username =
      normalizeUsername(
        input.value
      );

    if (!username) {
      return;
    }

    console.log(
      "Checking:",
      username
    );

    try {
      const response =
        await fetch(
          `/api/handles/${encodeURIComponent(
            username
          )}`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json"
            },

            cache: "no-store"
          }
        );


      const data =
        await response
          .json()
          .catch(() => ({}));


      console.log(
        "Availability response:",
        response.status,
        data
      );


      if (!response.ok) {
        msg(
          data.error ||
          "Could not check availability."
        );

        return;
      }


      if (data.available) {
        msg(
          `@${username} is available ✦`
        );
      } else {
        msg(
          `@${username} is already taken.`
        );
      }

    } catch (error) {
      console.error(
        "Availability error:",
        error
      );

      msg(
        "Could not check availability."
      );
    }
  }


  /*
  -------------------------------------------------------
  Claim
  -------------------------------------------------------
  */

  async function claimHandle(form) {
    const input =
      form.querySelector("input");

    const button =
      form.querySelector(
        'button[type="submit"]'
      ) ||
      form.querySelector(
        "button"
      );


    if (!input || !button) {
      console.error(
        "❌ Claim form is missing input/button."
      );

      return;
    }


    const username =
      normalizeUsername(
        input.value
      );


    input.value =
      username;


    if (!username) {
      msg(
        "Enter a username first."
      );

      input.focus();

      return;
    }


    console.log(
      "🚀 Claiming:",
      username
    );


    const originalHTML =
      button.innerHTML;


    button.disabled = true;

    button.innerHTML =
      "Claiming <b>…</b>";


    try {
      console.log(
        "POST /api/handles"
      );


      const response =
        await fetch(
          "/api/handles",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json"
            },

            body: JSON.stringify({
              username
            })
          }
        );


      console.log(
        "Claim status:",
        response.status
      );


      const data =
        await response
          .json()
          .catch(() => ({}));


      console.log(
        "Claim response:",
        data
      );


      if (!response.ok) {
        throw new Error(
          data.error ||
          `Claim failed (${response.status})`
        );
      }


      /*
      ---------------------------------------------------
      Successful claim
      ---------------------------------------------------
      */

      const finalUsername =
        data.user?.username ||
        data.username ||
        username;


      const profileUrl =
        data.profileUrl ||
        `/u/${encodeURIComponent(
          finalUsername
        )}`;


      console.log(
        "✅ CLAIM SUCCESSFUL"
      );

      console.log(
        "Username:",
        finalUsername
      );

      console.log(
        "Redirecting to:",
        profileUrl
      );


      msg(
        `Claimed void.link/${finalUsername} ✦`
      );


      /*
       * Navigate directly.
       */

      window.location.assign(
        profileUrl
      );

    } catch (error) {
      console.error(
        "❌ Claim error:",
        error
      );


      msg(
        error.message ||
        "Could not claim that handle."
      );


      button.disabled = false;

      button.innerHTML =
        originalHTML;
    }
  }


  /*
  -------------------------------------------------------
  Attach claim handlers
  -------------------------------------------------------
  */

  forms.forEach(
    (form, index) => {
      console.log(
        `Attaching claim handler #${index + 1}`
      );


      form.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          event.stopPropagation();

          console.log(
            "📨 Claim form submitted"
          );

          claimHandle(form);
        }
      );


      const input =
        form.querySelector("input");


      if (!input) {
        return;
      }


      /*
      Input sanitizing
      */

      input.addEventListener(
        "input",
        () => {
          const position =
            input.selectionStart;

          input.value =
            normalizeUsername(
              input.value
            );

          try {
            input.setSelectionRange(
              position,
              position
            );
          } catch {}
        }
      );


      /*
      Availability checking
      */

      input.addEventListener(
        "input",
        () => {
          clearTimeout(
            availabilityTimer
          );


          if (
            !input.value.trim()
          ) {
            return;
          }


          availabilityTimer =
            setTimeout(
              () => {
                checkAvailability(
                  form
                );
              },
              400
            );
        }
      );
    }
  );


  console.log(
    "✅ VOID.LINK claim system ready."
  );
});
```
