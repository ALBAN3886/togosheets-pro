export function qs(selector, root = document) { return root.querySelector(selector); }
export function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
export function html(node, content) { if (node) node.innerHTML = content; }
export function on(root, event, selector, handler) {
  root.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if (target) handler(e, target);
  });
}
