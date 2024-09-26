<script lang="ts">
	import { onMount } from "svelte";
	import "./tailwind.css";

	interface ProfileData {
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
			description?: string;
		}>;
		fullText: string;
	}

	interface HooksData {
		hooks?: string[];
		error?: string;
	}

	let data: ProfileData = {
		name: "",
		headline: "",
		location: "",
		connections: "",
		bio: "",
		experience: [],
		fullText: "",
	};
	let hooks: string[] = [];
	let error: string = "";
	let loading: boolean = true;

	function sendMessageAsync(message: any): Promise<any> {
		return new Promise((resolve, reject) => {
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				const activeTab = tabs[0];
				if (activeTab && activeTab.id) {
					chrome.tabs.sendMessage(activeTab.id, message, (response) => {
						if (chrome.runtime.lastError) {
							reject(chrome.runtime.lastError.message);
						} else {
							resolve(response);
						}
					});
				} else {
					reject("No active tab found");
				}
			});
		});
	}

	onMount(async () => {
		try {
			const response = await sendMessageAsync({ action: "getContent" });
			if (response.error) {
				loading = false;
				error = response.error;
				console.error("Error:", error);
			} else if (response.aiData) {
				data = response.aiData;
				console.log("Received data:", data);

				// Make second API call to get top hooks
				const hooksResponse: HooksData = await sendMessageAsync({
					action: "getTopHooks",
					aiData: data,
				});
				if (hooksResponse.error) {
					error = hooksResponse.error;
					console.error("Error fetching hooks:", error);
				} else if (hooksResponse.hooks) {
					hooks = hooksResponse.hooks;
					console.log("Received hooks:", hooks);
				} else {
					error = "Invalid hooks response received";
					console.error("Invalid hooks response:", hooksResponse);
				}
				loading = false;
			} else {
				loading = false;
				error = "Invalid response received";
				console.error("Invalid response:", response);
			}
		} catch (err) {
			loading = false;
			error = typeof err === "string" ? err : "An unknown error occurred";
			console.error("Error:", error);
		}
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
			<!-- Top Hooks Section -->
			{#if hooks.length > 0}
				<section class="bg-yellow-100 rounded-lg shadow p-4">
					<h2 class="text-xl font-semibold mb-2 text-yellow-800">Top Hooks</h2>
					<ol class="list-decimal list-inside space-y-1">
						{#each hooks as hook}
							<li class="text-gray-700">{hook}</li>
						{/each}
					</ol>
				</section>
			{/if}

			<!-- Profile Header -->
			<div class="bg-white rounded-lg shadow p-4">
				<h1 class="text-2xl font-bold">{data.name || "Name Not Available"}</h1>
				<p class="text-lg text-gray-600">{data.headline || "Headline Not Available"}</p>
				<p class="text-sm text-gray-500">{data.location || "Location Not Available"}</p>
				<!-- Removed followers as it's not defined in ProfileData -->
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
								<h3 class="text-lg font-medium">{job.title}</h3>
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
		</div>
	{/if}
</main>
