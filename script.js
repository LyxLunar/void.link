async function claimHandle(form) {
  const input = form.querySelector("input");
  const username = normalize(input.value);

  input.value = username;

  if (username.length < 1) {
    return msg("Handles can be 1–24 characters.");
  }

  if (username.length > 24) {
    return msg("That handle is too long.");
  }

  try {
    const res = await fetch("/api/handles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        plan: selectedPlan
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Could not claim that handle.");
    }

    // The server has successfully created the handle.
    msg(`Claimed void.link/${data.user.username} ✦`);

    setAvailability(
      true,
      `@${data.user.username} is yours — ${data.user.plan} plan`
    );

    input.value = data.user.username;

    // Navigate to the profile returned by the server.
    window.location.assign(data.profileUrl);

  } catch (err) {
    msg(
      err.message ||
      "The server is offline. Start the included Node server first."
    );
  }
}
