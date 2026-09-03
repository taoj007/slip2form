# Slip2Form Story

## Core Thesis

Slip2Form is not an AI tax product. It is an interaction model for the web:

> The user brings their own AI, and the website exposes safe, structured actions that AI can use.

This prototype uses a tax intake form to demonstrate that idea.

## Inspiration

Tax forms are a good example of a frustrating but common web workflow. The information often already exists on a tax slip, but the user still has to locate the right fields, interpret unfamiliar labels, and manually re-enter each value into another form.

At the same time, many users already rely on AI assistants to read documents and explain complicated information. The problem is that most websites cannot work directly with the AI the user already trusts. Instead, users are forced to copy information back and forth, depend on brittle browser automation, or interact with another embedded chatbot that adds cost, complexity, and privacy concerns.

Slip2Form explores a different idea:

> A website does not need to provide the AI. It only needs to be understandable and operable by the user's AI.

Using WebMCP, Slip2Form turns a tax form into something an AI assistant can interact with through clear, structured actions. The agent can help with repetitive data transfer, while the user stays in control of every change.

## What It Does

Slip2Form is an agent-ready online tax intake form.

A user can give a tax slip to their own AI assistant and ask it to fill the current page using only clearly supported information. The AI discovers the WebMCP tools exposed by Slip2Form and uses them to update the live form directly.

The experience is collaborative rather than fully automated:

- AI-generated changes are clearly identified.
- The user can review highlighted updates before trusting them.
- Any field can still be edited manually.
- The form remains usable without AI assistance.
- Uncertain values should be left blank rather than guessed.

This creates a shared-control workflow: the AI handles repetitive form-filling, while the human keeps final authority.

Slip2Form is a prototype for tax-information intake. It does not prepare a full tax return, file with the CRA, or provide tax advice.

## Why WebMCP Fits

Traditional browser agents operate indirectly. They inspect the page, hunt for the correct input, simulate clicks and keystrokes, and hope the interface has not changed.

Slip2Form uses a more reliable model. Instead of exposing raw UI controls, it exposes semantic actions such as `set_employment_income`, each with a clear description and structured input schema. That gives the AI a meaningful interface to the website, not just a visual surface to manipulate.

The flow becomes:

```text
User gives instructions to their AI
-> AI understands the document
-> AI selects a Slip2Form WebMCP tool
-> Structured values update app state
-> The form updates live
-> The user reviews and overrides if needed
```

This is the key product idea: the website and the user's AI can work on the same live page without the site needing to embed its own assistant.

## How We Built It

Slip2Form is built with Next.js, React, and TypeScript.

The page registers agent-facing actions through the WebMCP imperative API. A representative tool looks like this:

```ts
document.modelContext.registerTool({
  name: "set_employment_income",
  description: "Set or update employment income in the current tax intake form.",
  inputSchema: {
    type: "object",
    properties: {
      amount: {
        type: "number",
        minimum: 0,
      },
    },
    required: ["amount"],
    additionalProperties: false,
  },
  execute: async ({ amount }) => {
    // Update the same application state used by the human interface.
  },
});
```

A key architectural decision was to avoid having WebMCP tools manipulate the DOM directly.

Manual input and agent actions use the same underlying application-state update functions:

```text
Human input ----\
                -> Shared domain action -> React state -> Live form
WebMCP tool ----/
```

This keeps the interface predictable and ensures that the human and agent are always working with the same source of truth.

## Challenges

### Working With an Experimental Standard

WebMCP is evolving quickly. Browser flags, debugging tools, extensions, and API examples can change between Chrome versions. We had to separate problems in the website implementation from compatibility issues in older testing extensions.

Chrome DevTools became the most reliable source of truth for confirming that a tool was registered, discoverable, and executable.

### Designing Tools for Agents Instead of Exposing UI Controls

A tool named `click_the_second_input` would reproduce brittle browser automation.

A tool named `set_employment_income`, with a clear schema and description, communicates business intent. Designing useful semantic actions required thinking beyond individual buttons and inputs.

### Preserving Human Control

Automatically filling a form is easy to demonstrate, but tax information can be sensitive and consequential. The harder design problem was making agent changes visible and correctable immediately.

Slip2Form therefore treats transparency, review, and manual override as core product behavior rather than optional safeguards.

### Helping First-Time Users Understand the Workflow

A regular user may not know which document to prepare or what instruction to give their AI. The experience needs lightweight onboarding that explains:

1. Prepare a supported tax slip.
2. Give the slip to the user's AI.
3. Ask the AI to fill only clearly supported values.
4. Review every agent-generated change.

## What We Learned

The biggest lesson is that an agent-ready website is not just a normal website plus a chatbot.

It has two interfaces:

```text
Human interface
-> labels, inputs, validation, review

Agent interface
-> semantic tools, schemas, descriptions, structured actions
```

Both should operate on the same underlying application logic.

We also learned that the best experience is not full automation. In sensitive workflows like tax intake, the stronger pattern is visible collaboration:

> The agent does the repetitive work, the interface makes every action transparent, and the human remains responsible for the final decision.

## What's Next

Slip2Form is a tax-intake prototype, but the pattern extends well beyond taxes. The same approach could support:

- Insurance applications
- Mortgage applications
- Government-benefit forms
- Medical intake
- School registration
- Visa applications
- Employment onboarding

The broader vision is a web where users no longer have to manually transfer information that their AI can already understand, and websites no longer have to build and host their own AI assistant just to participate in that workflow.

Slip2Form demonstrates how WebMCP can make that possible.
