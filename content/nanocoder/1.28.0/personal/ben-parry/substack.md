<!-- angle: The placement of an agent inside a workflow decides what behaviours are even possible. A terminal-panel agent and an editor-native agent can run the same model and produce different systems, because the affordances of the place filter everything downstream. Architecture over features; placement over prompts. -->

---
kind: personal
member: ben-parry
channel: substack
product: nanocoder
version: "1.28.0"
generated_at: "2026-06-28T20:19:16.083Z"
model: "minimax-m3"
char_count: 14252
---

# The placement problem: why where an AI lives decides how it behaves

## Summary

Most debates about AI agent behaviour get the question wrong. They ask what the model is told to do, or what guardrails it has, or how clever the prompt is. None of those are the real lever. The real lever is placement: where the agent lives in your workflow, what affordances the surrounding environment provides, and what those affordances make possible without anyone having to build them. A terminal-panel agent and an editor-native agent running the same model produce different systems, because the shape of the place filters every downstream behaviour. This essay argues that the right way to think about agent design is not feature lists but architectural placement, and that the organisations building AI tooling well right now are the ones who have stopped arguing with the placement and started choosing it deliberately.

## Executive summary

- The placement of an AI agent inside a workflow decides what behaviours are even possible, ahead of model selection, prompting, or guardrails.
- Tools earn trust by architecting away the need for it, not by asking for more of it. Placement is the most reliable way to do that.
- The right question is not "what does it do?" but "where does it live, and what does that location force to be true?"

## Key points

- Placement is upstream of features. Every subsequent design decision is downstream of where the agent lives.
- The terminal is a filter, not a neutral surface. It strips affordances the agent could otherwise inherit from a richer environment.
- A smaller tool surface is not a feature limitation. It is an architectural commitment to match the cognitive bandwidth of the thing using it.
- History that survives a restart changes what an AI session even means. It stops being a moment and becomes a record.
- The teams building AI well right now are removing things from their tool surfaces faster than they are adding things to them.
- You cannot prompt your way out of a structural problem. The lever keeps moving upward to the architectural layer.
- If you have to ask the model to behave, you have already lost. The right system makes the bad behaviour structurally hard.
- Trust is a substitute for architecture. When a tool asks for trust, the architecture has not done its job.
- Editor-native agents inherit affordances for free: streaming, diffs, permission UI, selection.
- A local-first tool surface is the architectural equivalent of distributed infrastructure: fewer points of failure, fewer incentives to drift.
- The systems that feel safe are the ones that removed an option, not the ones that added a policy.
- Real work happens across days. A session model that pretends otherwise is forcing the user to live inside someone else's architectural decision.

---

## The cold-open

A clinic I used to work near kept two waiting rooms. One was for walk-ins. The other was for people who had called ahead. The walk-in room had chairs in rows, a reception desk behind a window, and a sign that said "please take a number." The call-ahead room had the same chairs but the sign said "we're expecting you." The chairs were identical. The lighting was identical. The clinical staff were the same people, working the same hours, with the same training.

The behaviour in those two rooms was not the same. In the walk-in room, every interaction had to begin with a credentialing ritual: who are you, what are you here for, do you have insurance, is your ID current. In the call-ahead room, that whole layer was already gone. The room had arranged for it to be gone. The patients were not more trusted. They were not better behaved. The room simply did not require trust because the room's shape had removed the need for it.

This is the thing almost nobody talks about when they talk about AI agents. The conversation gets stuck on what the model is told to do, what guardrails it has, what clever prompting prevents the bad outcome. As if the model were the system. The model is not the system. The system is the room.

## Founder thesis

I have spent the last two years building AI tooling inside a community collective. I have watched the same model behave well in one environment and badly in another, and almost all of the difference is the room.

A terminal-panel agent and an editor-native agent running the same weights, with the same prompt, will produce different systems. Not because the model has changed. Because the room has changed. The terminal has a fixed shape of interaction: a prompt, some coloured text, a permission yes/no. The editor has streaming, structured diffs, permission UI, selection, history, an undo button. Once you put an agent in the terminal, every feature you build has to fight the terminal's affordances. Once you put the same agent in the editor, you inherit those affordances for free, and your team gets to stop reinventing a half-decent version of what the editor already does well.

The leverage is enormous. Almost no one in the industry is naming it.

## The core argument: placement is architecture

The standard debate about agent design goes like this. There is a model. There is a system prompt. There are tools. There are guardrails. There is a developer policy. There is a user policy. There is a filter, a jailbreak resistance library, a red-team report. The team iterates on each of those until the model behaves well enough to ship. Then they ship, and the next behavioural bug emerges, and the iteration begins again.

This is a prompting-first view of the world. The system is a model with a configuration file. The configuration file is the policy. The job of the policy is to make the model safe.

I want to argue for a different view. The system is the room the model sits in. The room includes the placement, the affordances of the surrounding environment, the tool surface, the persistence model, and the things the user can see and do without any prompting at all. The model's behaviour is one input into that room, not the room itself. The room decides what behaviours are even possible.

When you build a system this way, several things change at once. You stop trying to prompt your way out of structural problems. You stop adding policies to compensate for affordances the placement removed. You start asking, for every feature, what affordance of the room would make this feature unnecessary. Sometimes the answer is none, and the feature is real work. Sometimes the answer is that the room is wrong, and the right move is to change the room.

## The core argument: tool surface as architectural commitment

A 7B local model cannot reliably juggle 33 tool definitions and the JSON arguments each one expects. The standard response to this is better prompting, or a smarter model, or a clever rephrasing of the tool descriptions. None of those are the right answer. The right answer is fewer tools, cleaner schemas, and profile inference that picks the right set without a config file.

This is not a feature decision. It is an architectural commitment. The tool surface is the contract between the model and the world. If the contract is too wide, the model cannot hold it. If the contract is too narrow, the model cannot act. The right width is the one the cognitive bandwidth of the thing using the contract can reliably handle. That is not a number you arrive at by adding features until the model stops failing. It is a number you arrive at by removing tools until the model stops failing.

The shift from adding to removing is the same shift that happens when a startup moves from feature velocity to product coherence. It feels like a loss of capability at first. It is not a loss of capability. It is the difference between a tool that does everything badly and a tool that does the right things reliably.

## The core argument: persistence as architectural commitment

A session model that pretends work happens inside a single sitting is forcing the user to live inside an architectural decision someone else made. The user's work did not happen inside that sitting. The user's work happened across days, across half-finished thoughts, across resumed files. A session that does not survive a restart is a session that pretends none of that matters.

When you build the persistence model correctly, the meaning of "an AI session" changes. It stops being a moment and becomes a record. The agent that resumes a session with full history visible to the user is not offering a feature. It is acknowledging that the work being done is the kind of work that has texture, and that texture is the thing the user needs to recover when they sit back down.

This is a quieter architectural commitment than placement, but it has the same shape. You are removing the assumption that the system can forget. You are making forgetting expensive. The user no longer has to reconstruct what happened yesterday from a summary. The history is the history. The agent picks up where it left off, with the conversation visible, with the texture intact.

## The dual argument: idealism and limitations

The placement-first view is not a panacea. It has real limits I want to name rather than paper over.

The first limit is that placement cannot solve intent problems. If the user does not know what they want, no affordance of the room will surface a missing intent. A model running inside an editor is no better than a model running inside a terminal at the moment of "what should I actually do here." The room helps with execution. It does not help with direction.

The second limit is that architectural commitments are expensive to undo. A team that chooses a wide tool surface will find it harder to narrow later than a team that chose narrow and widened deliberately. The same is true of placement: once you have shipped an agent as a terminal app, moving it into the editor is a rewrite, not a refactor.

The third limit is that some placements are simply unavailable. Enterprise environments cannot put an agent inside the editor because the editor is locked down. Regulated environments cannot put an agent on local hardware because the data cannot leave the managed cloud. The room I am describing is not the room everyone gets to build in.

The point is not that placement is everything. The point is that placement is upstream of almost everything.

## The evolution arc

Three years ago, the AI agent debate was about model selection. Which model is the best. Which model is the safest. Which model is the most capable. The model was the system, and the system prompt was the lever.

Two years ago, the debate moved to retrieval. Give the model the right context. Give it a vector store. Give it a tool to search the codebase. Context was the lever.

One year ago, the debate moved to agents. Give the model tools. Give it a planner. Give it a loop. Tool use was the lever.

Right now, the debate is moving again. It is moving to placement. Where does the agent live. What does the surrounding environment provide. What affordances does the room offer. Placement is the lever.

Each of these shifts has been a recognition that the previous lever was being asked to do work the lever could not do. Models cannot prompt their way out of bad context. Context cannot retrieve its way out of bad tools. Tools cannot plan their way out of bad placement. The lever keeps moving upward, toward the architectural layer, because that is the layer where the leverage actually lives.

## Founder stance

I want to say something here that is personal, not architectural.

I am tired of conversations about AI safety that are really conversations about AI trust. They ask the model to be safe. They ask the developer to be responsible. They ask the user to read the policy. They ask the organisation to commit to good behaviour. All of these are reasonable asks. None of them are the answer.

The answer is architecture. The answer is the room.

If a system requires the model to behave, the model will eventually not behave. If a system requires the developer to be careful, the developer will eventually be careless. If a system requires the user to read the policy, the user will eventually not read the policy. If a system requires the organisation to be good, the organisation will eventually not be good. These are not failures of character. They are the normal behaviour of humans under load. A system that depends on character is a system that will fail.

The only systems that hold up are the ones that have arranged for failure to be hard. The clinic waiting room did not require the receptionist to remember who had called ahead. The room did. The building did. The shape of the work did.

I want to build AI tools that work this way. I want to build tools where the bad behaviour is structurally expensive, where the good behaviour is the path of least resistance, where the user does not have to trust the tool because the tool has made trust unnecessary.

This is not a technical position. It is a moral one. The tools that ask for trust are the tools that have not done their job. The tools that earn trust by removing the need for it are the ones I want to spend my life building.

## The closing argument

The room is upstream of the behaviour. The placement is upstream of the feature. The architecture is upstream of the policy.

If you spend time around how AI tooling gets used inside companies, this shape shows up everywhere. The tools that feel good are the ones that removed something rather than added something. The tools that feel intrusive are the ones that bolted a feature onto a placement that was wrong from the start. The tools people trust are the ones that remember what happened yesterday without being asked.

The answer to most AI-tool questions is not more features. It is better architecture. It always has been.

If this is the kind of work you want to follow, Mind & Machine lands every other Sunday. The build lives in the GitHub discussions. The arguments live here.

---

*Ben Parry is co-founder of Ava Technologies and the Nano Collective. He writes Mind & Machine about the architecture of AI tooling and the systems that make trust unnecessary. Subscribe at substack.com/@followbenparry.*
