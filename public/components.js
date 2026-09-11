(() => {
  const isDashboard = location.pathname.startsWith("/dashboard/");
  const header = isDashboard
    ? `<header class="site-header"><nav class="site-nav" aria-label="Primary navigation"><a class="brand" href="/">imshare</a><a href="/dashboard/posts/">Posts</a><a href="/dashboard/tags/">Tags</a><a href="/dashboard/categories/">Categories</a><a href="/dashboard/settings/">Settings</a><a href="/account/">Account</a><a href="/dashboard/">Dashboard</a></nav></header>`
    : `<header class="site-header"><nav class="site-nav" aria-label="Primary navigation"><a class="brand" href="/">imshare</a><a href="/posts/">Posts</a><a href="/users/">Users</a><a href="/tags/">Tags</a><a href="/categories/">Categories</a><a href="/search/">Search</a><a href="/account/">Account</a><a href="/notifications/">Notifications</a></nav></header>`;
  const footer = `<footer><a href="/about/">About</a> · <a href="/faq/">FAQ</a> · <a href="/github/">GitHub</a> · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></footer>`;

  function mount() {
    document.querySelectorAll("header, site-header").forEach((node) => {
      node.outerHTML = header;
    });
    document.querySelectorAll("site-footer").forEach((node) => {
      node.outerHTML = footer;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
