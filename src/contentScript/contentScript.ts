const e = new XMLSerializer().serializeToString(document.head)
const token = (e.match(/"token"\:"(.+?)",/) ?? [])[1] ?? "";
if (token) chrome.runtime.sendMessage({ type: "setToken", data: token });
export {}