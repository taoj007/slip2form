# Slip2Form

Slip2Form is a WebMCP-enabled tax intake prototype. It demonstrates a simple pattern:

- the user brings their own AI assistant
- the website exposes safe, structured tools through WebMCP
- the AI updates the live form
- the user reviews every change before submission

This is a demo intake flow, not tax software. It does not file a return, calculate a refund, connect to the CRA, or provide tax advice.

## Why this exists

Most people can already use AI to read a document like a tax slip. The harder part is getting that information into a website safely and reliably without copy-paste or brittle browser automation.

Slip2Form shows a different model: the site does not provide the AI. It only needs to expose a clean interface that the user's AI can understand and operate.

## What the demo does

The app presents a simplified T1 intake form and registers WebMCP tools such as:

- `set_full_name`
- `set_date_of_birth`
- `set_employment_income`
- `set_income_tax_deducted`
- `set_rrsp_deduction`
- `set_notes`

Agent updates are applied through the same application state used by manual form input. Every AI change is highlighted for review, and the user can accept, edit, or undo it.

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS

## Local development

Requirements:

- Node.js 18+ recommended
- npm

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Testing instructions

No login is required.

To verify the project the way a judge would:

1. Open the live site in ChatGPT's in-app browser or Chrome with WebMCP enabled.
2. Confirm the page loads the Slip2Form intake form and shows WebMCP status.
3. Give your AI assistant a supported tax slip or extracted slip details.
4. Ask it to fill only values that are clearly supported by the source.
5. Confirm the agent can discover and call the Slip2Form WebMCP tools.
6. Confirm the form updates live and the changed fields are visibly flagged for review.
7. Review the activity log and the highlighted updates.
8. Accept, edit, or undo the AI changes before using the demo submit flow.

Example prompt:

```text
Use the WebMCP tools on this page to fill the Slip2Form intake with values that are clearly supported by the attached tax slip. Do not guess. If a value is ambiguous, leave it blank or mark it as needing confirmation.
```

## Submission notes

- This is a new project created for The WebMCP Challenge.
- The project is intended to stay public and unchanged after the submission deadline through the end of judging.
- The repository contains the WebMCP tool registration code and the full demo app required to run it.

## Project story

The longer write-up is in [SLIP2FORM_STORY.md](./SLIP2FORM_STORY.md).

## License

MIT. See [LICENSE](./LICENSE).
