import { z } from "zod";

export {};

console.log("Content script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "getContent") {
		(async () => {
			try {
				const mainContent = document.querySelector("main")?.innerText || "";
				console.log("Main content:", mainContent);
				const data = extractLinkedInData(mainContent);
				const aiData = await extractLinkedInDataWithAI(mainContent);
				console.log("Extracted data:", data);
				console.log("AI extracted data:", aiData);
				sendResponse({ data, aiData });
			} catch (error: any) {
				console.error("Error in content script:", error);
				sendResponse({ error: error.message });
			}
		})();
		return true; // Keeps the message channel open for sendResponse
	}

	if (message.action === "getTopHooks") {
		(async () => {
			try {
				const hooks = await generateTopHooks(message.aiData);
				console.log("Top 3 Hooks:", hooks.hooks);
				sendResponse({ hooks: hooks.hooks });
			} catch (error: any) {
				console.error("Error generating hooks:", error);
				sendResponse({ error: error.message });
			}
		})();
		return true;
	}
});

function convertToMarkdown(text: string): string {
	return text
		.split("\n")
		.map((line) => `${line}\n\n`)
		.join("");
}

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";

const openai = createOpenAI({
	apiKey: "MY_KEY",
});

async function extractLinkedInDataWithAI(input: string) {
	const { object } = await generateObject({
		model: openai("gpt-4o-mini"),
		system: "You are a friendly assistant!",
		prompt: input,
		schema: z.object({
			name: z.string(),
			headline: z.string(),
			location: z.string(),
			connections: z.string(),
			bio: z.string(),
			experience: z.array(
				z.object({
					title: z.string(),
					company: z.string(),
					duration: z.string(),
					location: z.string(),
				})
			),
		}),
	});
	console.log("🖇️  Extracted LinkedIn data with AI:", object);
	return object;
}

async function generateTopHooks(data: {
	name: string;
	headline: string;
	location: string;
	connections: string;
	bio: string;
	experience: Array<{
		title: string;
		company: string;
		duration: string;
		location: string;
	}>;
}): Promise<{ hooks?: string[] }> {
	const profileDescription = `
Name: ${data.name}
Headline: ${data.headline}
Location: ${data.location}
Connections: ${data.connections}
Bio: ${data.bio}
Experience:
${data.experience.map((exp, index) => `${index + 1}. ${exp.title} at ${exp.company} (${exp.duration}) - ${exp.location}`).join("\n")}
	`;

	const { object } = await generateObject({
		model: openai("gpt-4o-mini"),
		system: `You will be given a LinkedIn profile. 
You MUST provide the top 3 features of the profile, that areHIGHLY relevant to the company sales representative at "Ploy"
The 3 features MUST be unique, MUST be factual, MUST be directly from the profile.
Quote the feature then give "---" and then provide a short justification of why it's relevant to the company sales representative at "Ploy".

\n\n__________\n\nPloy company information:

Ploy provides a platform that automates identity and access management for companies. It helps manage employee access to cloud resources, streamline onboarding/offboarding, detect shadow IT, automate security processes, and ensure compliance. Ploy integrates with major tools and offers features like access reviews, OAuth token revocation, SaaS usage monitoring, and risk identification.`,
		prompt: `LinkedIn Profile Details:\n${profileDescription}`,
		schema: z.object({
			hooks: z.array(z.string()).length(3),
		}),
	});

	return object;
}

function extractLinkedInData(text: string) {
	console.log("Extracting LinkedIn data from:", text);
	const result = {
		name: "",
		headline: "",
		location: "",
		connections: "",
		bio: "",
		experience: [] as Array<{
			title: string;
			company: string;
			duration: string;
			location: string;
		}>,
		fullText: "",
	};

	if (!text) {
		console.error("No text provided to extractLinkedInData");
		return result;
	}

	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line);
	console.log("➡️  Processed lines:", lines);

	let currentSection: string | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!result.name && /^[A-Za-z]+(?: [A-Za-z.]+)*$/.test(line)) {
			result.name = line;
			continue;
		}

		if (!result.headline && result.name && line.includes("at")) {
			result.headline = line;
			continue;
		}

		if (line.includes("Contact info")) {
			result.location = lines[i - 1] || "";
			result.connections = lines[i + 1] || "";
			continue;
		}

		if (["About", "Experience", "Education"].includes(line)) {
			currentSection = line;
			continue;
		}

		if (currentSection === "About") {
			result.bio += line + " ";
		}

		if (currentSection === "Experience") {
			const experienceEntry: {
				title: string;
				company: string;
				duration: string;
				location: string;
			} = {
				title: line,
				company: "",
				duration: "",
				location: "",
			};
			i++;
			if (i < lines.length) experienceEntry.company = lines[i];
			i++;
			if (i < lines.length) experienceEntry.duration = lines[i];
			i++;
			if (i < lines.length && lines[i].includes(",")) {
				experienceEntry.location = lines[i];
			}
			result.experience.push(experienceEntry);
		}
	}

	result.bio = result.bio.replace(/…see more/g, "").trim();
	result.fullText = text;

	console.log("Extracted LinkedIn data:", result);
	return result;
}
