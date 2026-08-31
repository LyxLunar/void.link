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
      toast.classList.remove(
        "show"
      );
    }, 2600);
}


function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9._-]/g,
      ""
    );
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

  if (
    username.length > 24
  ) {
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


    if (
      !response.ok ||
      data.ok !== true
    ) {

      throw new Error(
        data.error ||
        "Could not claim that handle."
      );

    }


    /*
     * Prefer the URL generated
     * by the backend.
     *
     * This means the server remains
     * the source of truth.
     */

    const claimedUsername =
      data.user?.username ||
      username;

    const profileUrl =
      data.profileUrl ||
      `/u/${encodeURIComponent(
        claimedUsername
      )}`;


    msg(
      `Claimed void.link/${claimedUsername} ✦`
    );


    /*
     * THE REDIRECT
     */

    window.location.assign(
      profileUrl
    );

  } catch (error) {

    console.error(error);

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
 * Works with BOTH of your
 * .claim forms.
 */

document
  .querySelectorAll(".claim")
  .forEach(form => {

    form.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        claimHandle(form);

      }
    );

  });
