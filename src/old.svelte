<script lang="ts">
	import { onMount } from "svelte";
	import { z } from "zod";
	import "./tailwind.css";

	let data = {};
	let error = "";
	let loading = true;
	let aiResponse = null;

	const ResponseFormat = z.object({
		most_relevant_posts: z.array(
			z.object({
				type: z.enum(["post", "bio"]).describe("the type of the content"),
				content: z.string().describe("the actual content of the post or bio, verbatim."),
				highlights: z
					.array(z.number())
					.describe("the positions of the highlights in the content that are most relevant to the sales person."),
			})
		),
	});

	async function askChatGPT(input: string) {
		const system_prompt = `
CONTEXT: You are a sales expert.
You are given a profile of a person on LinkedIn.
The profile is a plain string.

TASK: 
You MUST understand the activity posts and the about/bio sections.
From this, you must decide which parts of the profile are most relevant to the sales person.
The sales person is looking for the parts of the profile that are most relevant to the product they are selling.

The sales person is selling an information security product.

You must reply with the most relevant posts and the most relevant about/bio sections, and which parts of the profile are most relevant to the sales person, which should be highlighted.
Return in JSON format that strictly adheres to the following structure:
{
  "most_relevant_posts": [
    {
      "type": "post" or "bio",
      "content": "the actual content of the post or bio, verbatim.",
      "highlights": [array of number positions in the content to highlight]
    },
    ...
  ]
}
`;

		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: "gpt-4-0613",
				messages: [
					{
						role: "system",
						content: system_prompt,
					},
					{
						role: "user",
						content: input,
					},
				],
				max_tokens: 4096,
			}),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();
		return result;
	}

	onMount(() => {
		chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
			const activeTab = tabs[0];
			if (activeTab && activeTab.id) {
				chrome.tabs.sendMessage(activeTab.id, { action: "getContent" }, async (response) => {
					loading = false;
					if (chrome.runtime.lastError) {
						error = chrome.runtime.lastError.message;
						console.error("Error:", error);
					} else if (response && response.data) {
						data = response.data;
						console.log("Received data:", data);

						try {
							const result = await askChatGPT(data.fullText);
							const parsedContent = JSON.parse(result.choices[0].message.content);
							aiResponse = ResponseFormat.parse(parsedContent);
							console.log("AI Response:", aiResponse);
						} catch (err) {
							error = "Error processing AI response";
							console.error("AI Error:", err);
						}
					} else {
						error = "Invalid response received";
						console.error("Invalid response:", response);
					}
				});
			} else {
				loading = false;
				error = "No active tab found";
				console.error("No active tab found");
			}
		});
	});
</script>

<svelte:head>
	<title>Lime Light Pro</title>
	<link rel="stylesheet" href="/build/bundle.css" />
</svelte:head>

<main class="w-96 h-[600px] overflow-y-auto bg-gray-100 text-gray-800 font-sans">
	{#if loading}
		<div class="flex items-center justify-center h-full">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
		</div>
	{:else if error}
		<div class="text-red-500 p-4">{error}</div>
	{:else if Object.keys(data).length === 0}
		<div class="text-gray-500 p-4">No data available</div>
	{:else}
		<div class="p-4 space-y-6">
			<!-- Profile Header -->
			<div class="bg-white rounded-lg shadow p-4">
				<h1 class="text-2xl font-bold">{data.name || "Name Not Available"}</h1>
				<p class="text-lg text-gray-600">{data.headline || "Headline Not Available"}</p>
				<p class="text-sm text-gray-500">{data.location || "Location Not Available"}</p>
				<p class="text-sm text-gray-500 mt-2">{data.followers || ""}</p>
				<p class="text-sm text-gray-500">{data.connections || ""}</p>
			</div>

			<!-- Bio Section -->
			{#if data.bio}
				<section class="bg-white rounded-lg shadow p-4">
					<h2 class="text-xl font-semibold mb-2">About</h2>
					<p class="text-sm text-gray-700">{data.bio}</p>
				</section>
			{/if}

			<!-- Recent Posts -->
			{#if data.posts && data.posts.length > 0}
				<section class="bg-white rounded-lg shadow p-4">
					<h2 class="text-xl font-semibold mb-4">Recent Posts</h2>
					<div class="space-y-4">
						{#each data.posts as post}
							<div class="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
								<p class="text-sm font-medium text-gray-600 mb-1">{post.title || ""}</p>
								<p class="text-sm text-gray-700 mb-2">{post.content || ""}</p>
								<div class="flex justify-between text-xs text-gray-500">
									<span>{post.reactions || ""}</span>
									<span>{post.comments || ""}</span>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Experience -->
			{#if data.experience && data.experience.length > 0}
				<section class="bg-white rounded-lg shadow p-4">
					<h2 class="text-xl font-semibold mb-4">Experience</h2>
					<div class="space-y-4">
						{#each data.experience as job}
							<div class="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
								<h3 class="text-lg font-medium">{job.jobTitle}</h3>
								<p class="text-sm text-gray-600">{job.company}</p>
								<p class="text-xs text-gray-500">{job.duration}</p>
								{#if job.location}
									<p class="text-xs text-gray-500">{job.location}</p>
								{/if}
								{#if job.description}
									<p class="text-sm text-gray-700 mt-2">{job.description}</p>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- AI Response Section -->
			{#if aiResponse}
				<section class="bg-white rounded-lg shadow p-4">
					<h2 class="text-xl font-semibold mb-4">AI Insights</h2>
					<div class="space-y-4">
						{#each aiResponse.most_relevant_posts as post}
							<div class="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
								<p class="text-sm font-medium text-gray-600 mb-1">{post.type === "post" ? "Post" : "Bio"}</p>
								<p class="text-sm text-gray-700 mb-2">
									{#each post.content.split("") as char, index}
										{#if post.highlights.includes(index)}
											<span class="bg-yellow-200">{char}</span>
										{:else}
											{char}
										{/if}
									{/each}
								</p>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	{/if}
</main>
