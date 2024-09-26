export {};

chrome.action.onClicked.addListener(async function (tab) {
	const mainPage = chrome.runtime.getURL("index.html");
	chrome.tabs.create({ url: mainPage });
	// await chrome.tabs.sendMessage(tab.id, { action: "capture" });
	console.log("Background script: Tab created and message sent");
});
