<!-- angle: The essay reframes the ownership/governance question as a question about what kind of relationship you want to have with the tools you depend on — not "which is better" but "what does this tool make inevitable, and do you want that?" Grounded in the Pi vs Nanocoder comparison but extending to a general principle about infrastructure trust. -->

---
kind: personal
member: ben-parry
channel: substack
slug: pi-versus-nanocoder
generated_at: "2026-05-19T19:31:33.919Z"
model: "minimax-m2.7"
char_count: 9140
---

There is a hospital near where I live that used to be genuinely excellent. The doctors were good, the culture was good, the care was good. Then it was acquired. The acquiring organisation ran it for two years before selling it to a private equity group, which ran it for eighteen months before it was sold again. Each time, the language stayed the same. Each time, the structure changed. The features (the doctors, the wards, the equipment) looked identical. The outcomes were not.

This is not a healthcare essay. But the pattern is worth holding because it shows up everywhere. A law firm built around strong client relationships gets acquired and gradually shifts toward extracting value from partners rather than clients. A news organisation built around editorial integrity gets a new owner and discovers that editorial integrity and shareholder returns are not always the same thing. A therapy platform that started with patient wellbeing at its centre finds itself optimising for engagement metrics. The architecture of a thing shapes what it becomes. Not perfectly, not instantly. But structurally, over time, in ways that are hard to reverse.

I have been thinking about this pattern for years, in the context of software. Specifically, in the context of the tools that sit between a person and their work.

## The question worth asking

When people compare AI coding tools, they tend to focus on features. How many tools does it support? Does it have MCP? What models can you run? How does the TUI feel? These are reasonable questions. They are also where most comparisons stop.

The question worth asking first is simpler: who owns this, and what does that ownership make likely?

Pi started as Mario Zechner's solo MIT project. He built it carefully, shipped it, and left it open for anyone to use. It was one of the more thoughtful terminal coding agents available. In April 2026, it moved to a new home: Earendil, a company backed by Accel and Balderton. They published an RFC explaining their plans. The core would stay MIT. Commercial work would be built on top. They were more honest about it than most acquirers are.

That honesty matters. But it is not the same as architecture.

When a company has investors, it eventually needs a return. The RFC makes this explicit: commercial offerings are coming, and the team does not yet know what they will be. When the roadmap has to support a business model, "what users need" and "what we need to monetise" can stop being the same question. And when they diverge, the answer tends in one direction. Not from malice. From incentives.

Nanocoder is built by the Nano Collective. There is no VC, no cap table, no holding company, no exit pressure. The roadmap is public and decided by the people using the tool. Development is funded through donations and consulting work, not by converting users to subscribers.

This is not the idealistic version of why the structure matters. It is the structural version.

## Why this particular infrastructure is different

Most software tools do not require you to think about who owns them. Your text editor, your shell, your version control system. These are infrastructure, but they are static infrastructure. They do not have a business model to maintain. They do not face quarterly pressure. They change slowly, if at all.

AI coding agents are different. They sit between you and your code. They write it, edit it, understand it. They see what you are working on. They make decisions about how things should be structured. Over time, they accumulate context about your codebase, your patterns, your preferences.

That is a different kind of trust than the trust you place in a static tool. And it is a different kind of risk.

A tool with that level of access, owned by a corporation with shareholders, is a tool that can change its terms at any point. Not because the people running it are bad. Most of them are not. But because the structure creates pressure that eventually finds expression. The incentive to monetise access to that position is structural, not personal. It will not appear in the roadmap as "extract more value from users." It will appear as "we need to build a sustainable business," which sounds reasonable until you notice that the free tier is getting slower, or that the useful features are gating behind a subscription, or that the company was just acquired by something with different priorities.

I am not describing a hypothetical. This is the documented history of developer tools, going back decades. The pattern is so consistent it barely qualifies as a prediction.

## What the structural argument gets wrong

I want to be honest about the limits of this argument, because I think it is easy to overstate it, and the overstatement undermines the real point.

Community ownership does not guarantee better code. A distributed collective can move slowly, struggle with coordination, and produce inconsistent output. Open source projects die all the time. The absence of a VC does not make a project good. What it changes is the pressure profile. Not the quality ceiling.

Pi's team has been more transparent about the structure than most. The RFC is public. The MIT license is real. Earendil is a Public Benefit Corporation, which has a fiduciary duty beyond pure shareholder returns. That is more than most companies offer at this stage, and it deserves credit.

But legal duty and structural constraint are not the same thing. A PBC must consider stakeholders, but "consider" and "prioritise" are different words. And the structure remains one where investors eventually need a return. That is an architectural fact, not a character judgement.

The real question is not "do I trust this team today?" It is "what does the structure make likely when the pressures mount?"

## The practical difference

On the technical side, the two tools take genuinely different positions.

Pi ships a minimal core: four tools and a short system prompt. MCP, sub-agents, plan mode. These are TypeScript extensions you add yourself. The view is that these features create context overhead and observability problems, and that a small harness you extend is cleaner than a large application you work around. This is a coherent philosophical position, and if you agree with it, Pi is built for you.

Nanocoder takes the opposite view. A local-first coding agent should be useful the moment you install it. MCP servers load from config at startup. Sub-agents are a built-in primitive. Plan mode is a first-class UI, not a markdown convention. Scheduling runs on cron, with interactive tools auto-disabled for unattended runs. Ollama is a first-class provider, not an afterthought. The TUI is built with React and Ink.js: tool confirmations, formatted diffs, file explorers, status bars, notifications. Four modes are baked in and toggled with Shift+Tab: normal, auto-accept, yolo, and plan.

There is no paid tier. No telemetry you cannot see. The roadmap is public.

Neither approach is wrong. They are aimed at different people, and they are accountable to different people.

## What longevity actually means

I have spent a long time thinking about what longevity means, in this context. Not just "will the project keep existing" but "what kind of relationship will I have with this tool in five years, and who will be making the decisions that shape it?"

I do not think longevity means the project survives indefinitely. No project does. What longevity means, for a tool you depend on, is that the relationship stays recognisable. That it does not quietly become something else while you are still relying on it.

The worst case for a community collective is that the project forks and someone else keeps going. That is not a guarantee of longevity. It is a guarantee of the right failure mode.

The worst case for a VC-backed project is not that it forks. It is that the roadmap changes, the free tier degrades, the useful features get behind a paywall, or the whole thing is acquired and the new owner makes different architectural choices. The tool you depended on becomes a different tool, and you have to decide whether to follow it or rebuild your workflow.

Both can fail. They fail differently.

## The real question

I am not going to pretend this is a neutral choice. It shapes everything for me personally, and it is part of why I am involved with the Nano Collective at all. I co-founded Ava Technologies because I wanted to build software that respected the people using it. Software that did not extract value from its position, and that stayed in a form its users could rely on. That is why Nanocoder is built the way it is.

But the essay is not asking you to care about my reasons. It is asking you to notice what the structural argument actually is, and to apply it consciously.

The question worth asking is not which tool is better. It is what kind of relationship you want to have with the tool between you and your code, and who you want making the decisions that shape it.

That answer is yours to make. But it is worth making deliberately, with open eyes about what ownership actually means.

---

*If you found this useful, the best way to support the work is to try Nanocoder and, if it works for you, spread the word. The Nano Collective survives on people who build things worth talking about.*