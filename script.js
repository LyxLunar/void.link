```js
const toast =
  document.querySelector(".toast");


function msg(text) {
  if (!toast) {
    console.log(text);
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
    }, 2600);
}


function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9._-]/g,
      ""
    )
    .slice(0, 24);
}


let selectedPlan = "free";


async function claimHandle(form) {
  const input =
    form.querySelector("input");

  const button =
    form.querySelector("button");

  if (!input || !button) {
    return;
  }

  const username =
    normalize(input.value);

  input.value = username;

  if (!username) {
    msg(
      "Enter a handle first."
    );

    input.focus();

    return;
  }


  if (username.length > 24) {
    msg(
      "That handle is too long."
    );

    return;
  }


  const originalHTML =
    button.innerHTML;

  button.disabled = true;

  button.innerHTML =
    "Claiming <b>…</b>";


  try {
    const response =
      await fetch(
        "/api/handles",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body: JSON.stringify({
            username,
            plan:
              selectedPlan
          })
        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    console.log(
      "VOID.LINK claim response:",
      response.status,
      data
    );


    if (!response.ok) {
      throw new Error(
        data.error ||
        `Could not claim that handle. (${response.status})`
      );
    }


    /*
     * Your backend may return
     * user.username, username,
     * or just the requested username.
     */

    const finalUsername =
      data.user?.username ||
      data.username ||
      username;


    /*
     * Use the backend's profileUrl
     * when available.
     *
     * Otherwise build it ourselves.
     */

    let profileUrl =
      data.profileUrl ||
      `/u/${encodeURIComponent(
        finalUsername
      )}`;


    /*
     * Make sure an absolute backend
     * URL cannot break the redirect.
     */

    try {
      const url =
        new URL(
          profileUrl,
          window.location.origin
        );

      profileUrl =
        url.pathname +
        url.search +
        url.hash;

    } catch {
      profileUrl =
        `/u/${encodeURIComponent(
          finalUsername
        )}`;
    }


    msg(
      `Claimed void.link/${finalUsername} ✦`
    );


    /*
     * IMPORTANT:
     *
     * Don't use another submit
     * handler after this.
     *
     * Navigate directly.
     */

    window.location.href =
      profileUrl;


  } catch (error) {
    console.error(
      "VOID.LINK claim error:",
      error
    );

    msg(
      error.message ||
      "Something went wrong."
    );

    button.disabled = false;

    button.innerHTML =
      originalHTML;
  }
}


/*
 * Attach exactly ONE submit
 * listener to each claim form.
 */

document
  .querySelectorAll(
    "form.claim"
  )
  .forEach(form => {

    form.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        event.stopPropagation();

        claimHandle(form);

      }
    );

  });
```
