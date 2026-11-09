const $ = (id) => document.getElementById(id);
const namesInput = $("names");
const selects = [$("person-a"), $("person-b")];
const themeToggle = $("theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
let exclusions = [];

function setTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  const label = `Switch to ${isDark ? "light" : "dark"} mode`;
  themeToggle.setAttribute("aria-label", label);
  themeToggle.title = label;
  themeToggle.firstElementChild.textContent = isDark ? "☀" : "☾";
  themeColor.content = isDark ? "#161b18" : "#153e35";
  if (persist) {
    try {
      localStorage.setItem("theme", theme);
    } catch (error) {
      console.warn("Could not save the theme preference.", error);
    }
  }
}

try {
  const savedTheme = localStorage.getItem("theme");
  setTheme(savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
} catch (error) {
  console.warn("Could not read the theme preference.", error);
  setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
});

function names() {
  return namesInput.value.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
}

function updateParticipants() {
  const people = names();
  $("name-count").textContent = `${people.length} ${people.length === 1 ? "PERSON" : "PEOPLE"}`;
  for (const [index, select] of selects.entries()) {
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = index === 0 ? "Select a person" : "Select another person";
    select.append(placeholder);
    people.forEach((name, i) => {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = name;
      select.append(option);
    });
  }
  if (exclusions.length) {
    exclusions = [];
    renderExclusions();
    $("setup-message").textContent = "Your participant list changed, so exclusions were cleared.";
  }
}

function renderExclusions() {
  const people = names();
  $("exclusion-list").replaceChildren();
  exclusions.forEach(([a, b], index) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${people[a]} + ${people[b]}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove exclusion for ${people[a]} and ${people[b]}`);
    remove.addEventListener("click", () => {
      exclusions.splice(index, 1);
      renderExclusions();
    });
    item.append(label, remove);
    $("exclusion-list").append(item);
  });
}

namesInput.addEventListener("input", updateParticipants);
$("add-exclusion").addEventListener("click", () => {
  const [a, b] = selects.map((select) => select.value);
  if (a === "" || b === "" || a === b) {
    $("setup-message").textContent = "Choose two different people to exclude.";
    return;
  }
  const pair = [Number(a), Number(b)].sort((x, y) => x - y);
  if (exclusions.some(([x, y]) => x === pair[0] && y === pair[1])) {
    $("setup-message").textContent = "That pair is already excluded.";
    return;
  }
  exclusions.push(pair);
  renderExclusions();
  $("setup-message").textContent = "Pair excluded in both directions.";
});
updateParticipants();

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

$("draw-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("draw-button");
  button.disabled = true;
  button.textContent = "Creating your draw…";
  $("setup-message").textContent = "";
  try {
    const result = await post("/api/draw", { names: names(), exclusions });
    for (const { name, token } of result.links) {
      const row = document.createElement("div");
      row.className = "link-row";
      const label = document.createElement("label");
      label.textContent = name;
      const link = document.createElement("input");
      link.readOnly = true;
      link.value = `${location.origin}/#reveal=${token}`;
      link.setAttribute("aria-label", `Private link for ${name}`);
      const copy = document.createElement("button");
      copy.className = "button button-outline";
      copy.type = "button";
      copy.textContent = "Copy link";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(link.value);
          $("results-message").textContent = `Link for ${name} copied.`;
        } catch {
          link.focus();
          link.select();
          $("results-message").textContent = "Select and copy the link manually.";
        }
      });
      label.append(link);
      row.append(label, copy);
      $("link-list").append(row);
    }
    $("organizer").classList.add("hidden");
    $("results").classList.remove("hidden");
    $("results-title").focus();
    window.scrollTo(0, 0);
  } catch (error) {
    $("setup-message").textContent = error.message || "Could not create your draw. Please try again.";
  } finally {
    button.disabled = false;
    button.textContent = "Create the draw ↗";
  }
});

const revealToken = new URLSearchParams(location.hash.slice(1)).get("reveal");
if (revealToken !== null) {
  $("organizer").classList.add("hidden");
  $("reveal").classList.remove("hidden");
}
$("reveal-button").addEventListener("click", async () => {
  const button = $("reveal-button");
  button.disabled = true;
  $("reveal-message").textContent = "";
  try {
    const assignment = await post("/api/reveal", { token: revealToken });
    $("reveal-heading").textContent = assignment.recipient;
    $("reveal-description").textContent = `${assignment.giver}, you're their Secret Santa!`;
    button.hidden = true;
  } catch (error) {
    $("reveal-message").textContent = error.message || "Could not reveal your assignment. Please try again.";
  } finally {
    button.disabled = false;
  }
});
